import { randomUUID, webcrypto } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canonicalJson, GENESIS_HASH, sha256Hex } from "@/lib/canonical";
import type { Db } from "@/server/db/client";
import { devices, journalEntries, riskAlerts, syncConflicts, syncOps } from "@/server/db/schema";
import { balanceOf } from "@/server/ledger/operations";
import { applyBatch, registerDevice } from "@/server/sync/engine";
import type { IncomingOp } from "@/server/sync/schemas";
import { makeMerchant, testDb } from "./helpers";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await testDb());
});
afterAll(() => close());

/** Plays the part of a phone: holds a key, numbers operations and chains their hashes, exactly like src/lib/offline. */
async function phone(userId: string) {
  const keys = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const publicKey = JSON.stringify(await webcrypto.subtle.exportKey("jwk", keys.publicKey));
  const deviceId = await registerDevice(db, userId, { publicKey, label: "Telefone de teste" });
  let seq = 0;
  let prevHash = GENESIS_HASH;
  const sign = async (type: string, payload: Record<string, unknown>, opts: { clientTime?: string; opId?: string } = {}): Promise<IncomingOp> => {
    seq += 1;
    const base = { opId: opts.opId ?? randomUUID(), type, payload, channel: "app" as const, clientTime: opts.clientTime ?? new Date().toISOString(), deviceSeq: seq, prevHash };
    const hash = await sha256Hex(canonicalJson(base));
    const raw = await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, new TextEncoder().encode(hash));
    prevHash = hash;
    return { ...base, hash, signature: Buffer.from(raw).toString("base64url") };
  };
  return { deviceId, sign, skip: () => (seq += 5) };
}

describe("sincronização offline", () => {
  it("aplica registos por ordem e é idempotente quando a rede repete o envio", async () => {
    const user = await makeMerchant(db);
    const device = await phone(user.id);
    const ops = [await device.sign("sale.record", { amountCents: 10_000 }), await device.sign("sale.record", { amountCents: 5_000 })];
    const first = await applyBatch(db, user.id, device.deviceId, ops);
    expect(first.results.map((row) => row.status)).toEqual(["applied", "applied"]);
    const second = await applyBatch(db, user.id, device.deviceId, ops);
    expect(second.results.map((row) => row.status)).toEqual(["duplicate", "duplicate"]);
    expect(second.results[0].entryId).toBe(first.results[0].entryId);
    expect(await balanceOf(db, user.id, "negocio")).toBe(15_000);
  });

  it("recusa assinatura inválida e levanta alerta, sem tocar no saldo", async () => {
    const user = await makeMerchant(db);
    const device = await phone(user.id);
    const op = await device.sign("sale.record", { amountCents: 99_000 });
    const tampered = { ...op, payload: { amountCents: 9_900_000 } };
    const { results } = await applyBatch(db, user.id, device.deviceId, [tampered]);
    expect(results[0].status).toBe("rejected");
    expect(await balanceOf(db, user.id, "negocio")).toBe(0);
    const alerts = await db.select().from(riskAlerts).where(eq(riskAlerts.subjectUserId, user.id));
    expect(alerts[0].rule).toBe("offline_assinatura_invalida");
  });

  it("uma cadeia quebrada fica guardada para revisão: nunca se perde uma venda real", async () => {
    const user = await makeMerchant(db);
    const device = await phone(user.id);
    await applyBatch(db, user.id, device.deviceId, [await device.sign("sale.record", { amountCents: 1_000 })]);
    device.skip();
    const { results } = await applyBatch(db, user.id, device.deviceId, [await device.sign("sale.record", { amountCents: 2_000 })]);
    expect(results[0].status).toBe("conflict");
    expect(await balanceOf(db, user.id, "negocio")).toBe(3_000);
    const conflicts = await db.select().from(syncConflicts).where(eq(syncConflicts.userId, user.id));
    expect(conflicts.map((row) => row.kind)).toContain("cadeia_quebrada");
  });

  it("assinala registos antigos e valores acima do limite offline", async () => {
    const user = await makeMerchant(db);
    const device = await phone(user.id);
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const { results } = await applyBatch(db, user.id, device.deviceId, [await device.sign("sale.record", { amountCents: 3_000_000 }, { clientTime: old })]);
    expect(results[0].status).toBe("conflict");
    expect(results[0].conflicts?.map((row) => row.kind).sort()).toEqual(["limite_offline", "registo_antigo"]);
  });

  it("guarda a hora real da venda, não a hora da sincronização", async () => {
    const user = await makeMerchant(db);
    const device = await phone(user.id);
    const when = new Date(Date.now() - 2 * 86_400_000).toISOString();
    await applyBatch(db, user.id, device.deviceId, [await device.sign("sale.record", { amountCents: 500 }, { clientTime: when })]);
    const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.userId, user.id));
    expect(entry.occurredAt.toISOString()).toBe(when);
    expect(entry.recordedAt.getTime()).toBeGreaterThan(entry.occurredAt.getTime());
  });

  it("uma operação proibida offline consome a fila sem bloquear as seguintes", async () => {
    const user = await makeMerchant(db);
    const device = await phone(user.id);
    const ops = [await device.sign("credit.accept", { applicationId: randomUUID() }), await device.sign("sale.record", { amountCents: 700 })];
    const { results } = await applyBatch(db, user.id, device.deviceId, ops);
    expect(results.map((row) => row.status)).toEqual(["rejected", "applied"]);
    const stored = await db.select().from(syncOps).where(eq(syncOps.userId, user.id));
    expect(stored).toHaveLength(2);
  });

  it("um produto criado offline pode ser usado logo a seguir na mesma fila", async () => {
    const user = await makeMerchant(db);
    const device = await phone(user.id);
    const productId = randomUUID();
    const { results } = await applyBatch(db, user.id, device.deviceId, [
      await device.sign("product.upsert", { id: productId, name: "Manga", unit: "balde" }),
      await device.sign("sale.record", { amountCents: 2_000, productId, quantity: 1 }),
    ]);
    expect(results[0].status).toBe("applied");
    expect(results[1].status).toBe("conflict");
    expect(results[1].conflicts?.[0].kind).toBe("stock_negativo");
  });

  it("não aceita a fila de outro comerciante nem de telefone bloqueado", async () => {
    const owner = await makeMerchant(db);
    const other = await makeMerchant(db);
    const device = await phone(owner.id);
    const op = await device.sign("sale.record", { amountCents: 100 });
    await expect(applyBatch(db, other.id, device.deviceId, [op])).rejects.toThrow(/não reconhecido/);
    await db.update(devices).set({ status: "perdido", wipeRequestedAt: new Date() }).where(eq(devices.id, device.deviceId));
    const blocked = await applyBatch(db, owner.id, device.deviceId, [op]);
    expect(blocked).toMatchObject({ blocked: true, wipe: true });
    expect(await balanceOf(db, owner.id, "negocio")).toBe(0);
  });
});
