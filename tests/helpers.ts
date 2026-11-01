import { randomUUID } from "node:crypto";
import { openPglite, type Db, type Tx } from "@/server/db/client";
import { agents, markets, users } from "@/server/db/schema";
import { createMerchant } from "@/server/auth/service";
import type { SessionUser } from "@/server/auth/session";
import type { OperationContext } from "@/server/ledger/operations";

export async function testDb() {
  return openPglite();
}

let phoneCounter = 3_000_000;

export async function makeMarket(db: Db) {
  const [market] = await db.insert(markets).values({ slug: `m-${randomUUID().slice(0, 8)}`, name: "Mercado Teste", district: "Teste" }).returning();
  return market;
}

export async function makeMerchant(db: Db, overrides: { name?: string; marketId?: string; agentId?: string | null } = {}) {
  const marketId = overrides.marketId ?? (await makeMarket(db)).id;
  phoneCounter += 1;
  const user = await db.transaction((tx) =>
    createMerchant(
      tx as Tx,
      { phone: `+25884${phoneCounter}`, displayName: overrides.name ?? "Comerciante Teste", businessName: "Banca Teste", marketId, activity: "Hortícolas", category: "Alimentos", agentId: overrides.agentId ?? null, status: "activo" },
      { id: null, role: "sistema" },
    ),
  );
  return user;
}

export async function makeStaff(db: Db, role: SessionUser["role"], name = "Equipa") {
  const [user] = await db.insert(users).values({ kind: "staff", role, email: `${randomUUID()}@teste.mz`, displayName: name, status: "activo" }).returning();
  return asSession(user);
}

export async function makeAgent(db: Db, marketId: string) {
  phoneCounter += 1;
  const [user] = await db.insert(users).values({ kind: "agent", role: "agent", phone: `+25884${phoneCounter}`, displayName: "Agente Teste", status: "activo" }).returning();
  const [agent] = await db.insert(agents).values({ userId: user.id, code: `AG-${phoneCounter}`, marketId, kioskName: "Quiosque", status: "activo" }).returning();
  return { user: asSession(user), agent };
}

export function asSession(user: typeof users.$inferSelect): SessionUser {
  return { id: user.id, kind: user.kind, role: user.role, displayName: user.displayName, phone: user.phone, email: user.email, isDemo: false, sessionId: randomUUID(), deviceId: null };
}

export function ctx(userId: string, overrides: Partial<OperationContext> = {}): OperationContext {
  return { userId, actorId: userId, channel: "app", opId: randomUUID(), occurredAt: new Date(), ...overrides };
}

export const inTx = <T,>(db: Db, run: (tx: Tx) => Promise<T>) => db.transaction((tx) => run(tx as Tx));
