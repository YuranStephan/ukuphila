import { canonicalJson, GENESIS_HASH, sha256Hex } from "@/lib/canonical";
import { kv, queue, wipeLocal } from "./idb";

/*
 * The phone half of the sync protocol (server half: src/server/sync/engine.ts).
 *
 * Each record gets the next device sequence number, the previous record's hash, its own hash and an ECDSA signature
 * from a key that cannot leave this browser (non-extractable CryptoKey kept in IndexedDB). The server checks all four,
 * so a queue edited on the device is detected, and a replay is ignored because opIds are unique.
 */

export type QueuedOp = {
  opId: string;
  type: string;
  payload: Record<string, unknown>;
  channel: "app" | "voz";
  clientTime: string;
  deviceSeq: number;
  prevHash: string;
  hash: string;
  signature: string;
};

export type OpResult = { opId: string; status: "applied" | "duplicate" | "conflict" | "rejected"; entryId?: string; message?: string; conflicts?: { kind: string; message: string }[] };

type DeviceState = { deviceId: string; userId: string; privateKey: CryptoKey; seq: number; prevHash: string };

const DEVICE_KEY = "device";

async function registerDevice(userId: string): Promise<DeviceState> {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const publicKey = JSON.stringify(await crypto.subtle.exportKey("jwk", keys.publicKey));
  const label = /Android/i.test(navigator.userAgent) ? "Telefone Android" : /iPhone|iPad/i.test(navigator.userAgent) ? "iPhone" : "Navegador";
  const response = await fetch("/api/app/device", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicKey, label }) });
  if (!response.ok) throw new Error("Não foi possível registar este telefone.");
  const { deviceId } = (await response.json()) as { deviceId: string };
  const state: DeviceState = { deviceId, userId, privateKey: keys.privateKey, seq: 0, prevHash: GENESIS_HASH };
  await kv.set(DEVICE_KEY, state);
  return state;
}

/** A device belongs to one person. Signing in as someone else on the same phone starts a fresh, empty device. */
export async function ensureDevice(userId: string) {
  const existing = await kv.get<DeviceState>(DEVICE_KEY);
  if (existing && existing.userId === userId) return existing;
  if (existing) await wipeLocal();
  return registerDevice(userId);
}

let chain: Promise<unknown> = Promise.resolve();

/** Records are numbered one at a time, even if the person taps twice quickly. */
export function enqueue(userId: string, type: string, payload: Record<string, unknown>, channel: "app" | "voz" = "app"): Promise<QueuedOp> {
  const next = chain.then(async () => {
    const device = await ensureDevice(userId);
    const base = { opId: crypto.randomUUID(), type, payload, channel, clientTime: new Date().toISOString(), deviceSeq: device.seq + 1, prevHash: device.prevHash };
    const hash = await sha256Hex(canonicalJson(base));
    const raw = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, device.privateKey, new TextEncoder().encode(hash));
    const signature = btoa(String.fromCharCode(...new Uint8Array(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const op: QueuedOp = { ...base, hash, signature };
    await queue.put(op);
    await kv.set(DEVICE_KEY, { ...device, seq: op.deviceSeq, prevHash: hash });
    return op;
  });
  chain = next.catch(() => undefined);
  return next;
}

export async function pendingOps() {
  return (await queue.all<QueuedOp>()).sort((a, b) => a.deviceSeq - b.deviceSeq);
}

export type FlushOutcome = { sent: number; results: OpResult[]; offline: boolean; wiped: boolean; signedOut: boolean };

let flushing: Promise<FlushOutcome> | null = null;

/** Sends the queue in order. Anything the server answered is removed, whatever the answer, because it was decided. */
export function flush(userId: string): Promise<FlushOutcome> {
  flushing ??= (async () => {
    const outcome: FlushOutcome = { sent: 0, results: [], offline: false, wiped: false, signedOut: false };
    try {
      const device = await ensureDevice(userId);
      let ops = await pendingOps();
      while (ops.length) {
        const batch = ops.slice(0, 40);
        let response: Response;
        try {
          response = await fetch("/api/app/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: device.deviceId, ops: batch }) });
        } catch {
          outcome.offline = true;
          break;
        }
        if (response.status === 401) {
          outcome.signedOut = true;
          break;
        }
        if (!response.ok) break;
        const body = (await response.json()) as { results: OpResult[]; wipe?: boolean; blocked?: boolean };
        if (body.wipe || body.blocked) {
          await wipeLocal();
          outcome.wiped = true;
          break;
        }
        for (const result of body.results) {
          const op = batch.find((item) => item.opId === result.opId);
          if (op) await queue.delete(op.deviceSeq);
        }
        outcome.sent += body.results.length;
        outcome.results.push(...body.results);
        ops = await pendingOps();
        if (body.results.length === 0) break;
      }
    } finally {
      flushing = null;
    }
    return outcome;
  })();
  return flushing;
}

export async function cacheSnapshot(snapshot: unknown) {
  await kv.set("snapshot", snapshot);
}

export async function cachedSnapshot<T>() {
  return kv.get<T>("snapshot");
}
