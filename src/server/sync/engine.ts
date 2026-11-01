import "server-only";
import { and, eq } from "drizzle-orm";
import { canonicalJson, sha256Hex } from "@/lib/canonical";
import { daysBetween, maputoDay } from "@/lib/dates";
import type { Db, Tx } from "../db/client";
import { devices, syncConflicts, syncOps, type Channel, type SyncOpStatus } from "../db/schema";
import { DomainError } from "../errors";
import { raiseAlert } from "../risk/alerts";
import { getSetting } from "../settings";
import { executeOp } from "./execute";
import { opPayloads, type IncomingOp, type OpType } from "./schemas";

export type OpResult = {
  opId: string;
  status: SyncOpStatus;
  entryId?: string;
  message?: string;
  conflicts?: { kind: string; message: string }[];
};

function isOpType(type: string): type is OpType {
  return type in opPayloads;
}

export function opDigestInput(op: Pick<IncomingOp, "opId" | "type" | "payload" | "channel" | "clientTime" | "deviceSeq" | "prevHash">) {
  return canonicalJson({
    opId: op.opId,
    type: op.type,
    payload: op.payload,
    channel: op.channel,
    clientTime: op.clientTime,
    deviceSeq: op.deviceSeq,
    prevHash: op.prevHash,
  });
}

async function verifySignature(publicKey: string, hash: string, signature: string) {
  try {
    const key = await crypto.subtle.importKey("jwk", JSON.parse(publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, Buffer.from(signature, "base64url"), new TextEncoder().encode(hash));
  } catch {
    return false;
  }
}

export async function registerDevice(db: Db, userId: string, input: { publicKey: string; label: string }) {
  const parsed = JSON.parse(input.publicKey) as { kty?: string; crv?: string; d?: string };
  if (parsed.kty !== "EC" || parsed.crv !== "P-256" || parsed.d) throw new DomainError("dispositivo", "Chave de dispositivo inválida.");
  const [device] = await db.insert(devices).values({ userId, label: input.label.slice(0, 80), publicKey: input.publicKey, status: "activo" }).returning({ id: devices.id });
  return device.id;
}

/**
 * Replays a device's queue, in order, one transaction per operation.
 *
 * Idempotent: a known opId returns its stored result and touches nothing. A signature that fails is refused and
 * alerted, because the record cannot be attributed. Everything else is kept: a broken chain, a late or large offline
 * record is applied and flagged for review, since losing a merchant's real sale is worse than reviewing it.
 */
export async function applyBatch(db: Db, userId: string, deviceId: string, ops: IncomingOp[]) {
  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
    .limit(1);
  if (!device) throw new DomainError("dispositivo", "Dispositivo não reconhecido.");
  if (device.status !== "activo") return { results: [] as OpResult[], wipe: Boolean(device.wipeRequestedAt), blocked: true };

  const policy = await getSetting(db, "offlinePolicy");
  let lastSeq = device.lastSeq;
  let lastHash = device.lastHash;
  const results: OpResult[] = [];

  for (const op of ops) {
    const [known] = await db.select().from(syncOps).where(eq(syncOps.opId, op.opId)).limit(1);
    if (known) {
      if (known.userId !== userId) throw new DomainError("dispositivo", "Operação inválida.");
      const stored = (known.result ?? {}) as Omit<OpResult, "opId" | "status">;
      results.push({ opId: op.opId, status: "duplicate", ...stored });
      continue;
    }

    const computed = await sha256Hex(opDigestInput(op));
    const signed = computed === op.hash && device.publicKey ? await verifySignature(device.publicKey, op.hash, op.signature) : false;
    if (!signed) {
      const message = "Este registo não pôde ser confirmado como vindo deste telefone e ficou de fora.";
      await db.transaction(async (rawTx) => {
        const tx = rawTx as Tx;
        await tx.insert(syncOps).values({ opId: op.opId, userId, deviceId, type: op.type, payload: op.payload, deviceSeq: op.deviceSeq, prevHash: op.prevHash, hash: op.hash, signature: op.signature, status: "rejected", result: { message }, clientTime: new Date(op.clientTime) });
        await raiseAlert(tx, {
          rule: "offline_assinatura_invalida",
          severity: "alta",
          title: "Registo offline com assinatura inválida",
          detail: "Um registo chegou com assinatura que não confere com a chave do dispositivo. Pode indicar manipulação local.",
          subjectUserId: userId,
          dedupeKey: `offline_assinatura:${deviceId}:${maputoDay()}`,
          evidence: { deviceId, opId: op.opId, deviceSeq: op.deviceSeq },
        });
      });
      results.push({ opId: op.opId, status: "rejected", message });
      continue;
    }

    const flags: { kind: string; message: string }[] = [];
    if (op.deviceSeq !== lastSeq + 1 || (lastHash !== null && op.prevHash !== lastHash)) {
      flags.push({ kind: "cadeia_quebrada", message: "A ordem dos registos deste telefone não confere. Os dados ficaram guardados para revisão." });
    }
    const age = daysBetween(maputoDay(new Date(op.clientTime)), maputoDay());
    if (age > policy.maxAgeDays) {
      flags.push({ kind: "registo_antigo", message: `Este registo tem ${age} dias. Confirma se a data está certa.` });
    }
    const amount = typeof op.payload.amountCents === "number" ? op.payload.amountCents : 0;
    if (amount > policy.maxOpCents) {
      flags.push({ kind: "limite_offline", message: "Este valor é maior do que o habitual para registos sem rede. Confirma com o teu agente." });
    }

    const channel: Channel = op.channel === "voz" ? "voz" : "app";
    try {
      if (!isOpType(op.type) || !policy.allowed.includes(op.type)) throw new DomainError("operacao", "Esta operação não pode ser feita sem rede.");
      const type = op.type;
      const outcome = await db.transaction(async (rawTx) => {
        const tx = rawTx as Tx;
        const applied = await executeOp(tx, { userId, actorId: userId, channel, opId: op.opId, occurredAt: new Date(op.clientTime) }, type, op.payload);
        for (const flag of flags) await tx.insert(syncConflicts).values({ userId, opId: op.opId, kind: flag.kind, message: flag.message });
        const conflicts = [...applied.conflicts, ...flags];
        await tx.insert(syncOps).values({
          opId: op.opId,
          userId,
          deviceId,
          type: op.type,
          payload: op.payload,
          deviceSeq: op.deviceSeq,
          prevHash: op.prevHash,
          hash: op.hash,
          signature: op.signature,
          status: conflicts.length ? "conflict" : "applied",
          result: { entryId: applied.entryId, conflicts },
          clientTime: new Date(op.clientTime),
        });
        await tx.update(devices).set({ lastSeq: op.deviceSeq, lastHash: op.hash, lastSyncAt: new Date() }).where(eq(devices.id, deviceId));
        if (flags.some((flag) => flag.kind === "cadeia_quebrada")) {
          await raiseAlert(tx, {
            rule: "offline_cadeia_quebrada",
            severity: "media",
            title: "Sequência offline quebrada",
            detail: "Um dispositivo enviou registos fora de ordem. Pode ser reinstalação ou manipulação local.",
            subjectUserId: userId,
            dedupeKey: `offline_cadeia:${deviceId}:${maputoDay()}`,
            evidence: { deviceId, expected: lastSeq + 1, got: op.deviceSeq },
          });
        }
        return { entryId: applied.entryId, conflicts };
      });
      lastSeq = op.deviceSeq;
      lastHash = op.hash;
      results.push({ opId: op.opId, status: outcome.conflicts.length ? "conflict" : "applied", ...outcome });
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      // A business refusal still consumes the operation, otherwise the queue would retry it forever.
      await db.transaction(async (rawTx) => {
        const tx = rawTx as Tx;
        await tx.insert(syncOps).values({ opId: op.opId, userId, deviceId, type: op.type, payload: op.payload, deviceSeq: op.deviceSeq, prevHash: op.prevHash, hash: op.hash, signature: op.signature, status: "rejected", result: { message: error.message }, clientTime: new Date(op.clientTime) });
        await tx.update(devices).set({ lastSeq: op.deviceSeq, lastHash: op.hash, lastSyncAt: new Date() }).where(eq(devices.id, deviceId));
      });
      lastSeq = op.deviceSeq;
      lastHash = op.hash;
      results.push({ opId: op.opId, status: "rejected", message: error.message });
    }
  }
  return { results, wipe: false, blocked: false, lastSeq, lastHash };
}
