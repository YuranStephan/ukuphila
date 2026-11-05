import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { recordAudit } from "../audit";
import type { SessionUser } from "../auth/session";
import { hashSecret, randomCode, verifySecret } from "../crypto";
import type { Db, Tx } from "../db/client";
import { agents, businesses, markets, supplierProducts, suppliers, users } from "../db/schema";
import { DomainError } from "../errors";

/** People who work with the programme in the field. They sign in with phone + activation code + PIN, like merchants. */

export async function createAgent(db: Db, admin: SessionUser, input: { name: string; phone: string; marketId: string; kiosk: string; hours?: string | null }) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new DomainError("telefone", "Esse número não parece um telemóvel de Moçambique.");
  if (input.name.trim().length < 2 || input.kiosk.trim().length < 2) throw new DomainError("agente", "Indica o nome e o quiosque.");
  const [market] = await db.select({ id: markets.id, slug: markets.slug }).from(markets).where(eq(markets.id, input.marketId)).limit(1);
  if (!market) throw new DomainError("mercado", "Escolhe o mercado.");
  return db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [user] = await tx.insert(users).values({ kind: "agent", role: "agent", phone, displayName: input.name.trim(), status: "activo" }).onConflictDoNothing({ target: users.phone }).returning({ id: users.id });
    if (!user) throw new DomainError("telefone_em_uso", "Este número já tem conta Ukuphila.");
    const code = `AG-${market.slug.slice(0, 3).toUpperCase()}-${randomCode(4)}`;
    await tx.insert(agents).values({ userId: user.id, code, marketId: market.id, kioskName: input.kiosk.trim(), kioskHours: input.hours?.trim() || null, status: "activo", trainedAt: new Date() });
    await recordAudit(tx, { actorId: admin.id, actorRole: admin.role, action: "agente.criado", subjectType: "user", subjectId: user.id, targetUserId: user.id, data: { marketId: market.id } });
    return user.id;
  });
}

export async function createSupplier(db: Db, admin: SessionUser, input: { name: string; category: string; phone: string }) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new DomainError("telefone", "Esse número não parece um telemóvel de Moçambique.");
  if (input.name.trim().length < 2) throw new DomainError("fornecedor", "Indica o nome do fornecedor.");
  return db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [owner] = await tx.insert(users).values({ kind: "supplier", role: "supplier", phone, displayName: input.name.trim(), status: "activo" }).onConflictDoNothing({ target: users.phone }).returning({ id: users.id });
    if (!owner) throw new DomainError("telefone_em_uso", "Este número já tem conta Ukuphila.");
    const [supplier] = await tx.insert(suppliers).values({ ownerId: owner.id, name: input.name.trim(), category: input.category.trim() || "Geral", phone, status: "activo" }).returning({ id: suppliers.id });
    await recordAudit(tx, { actorId: admin.id, actorRole: admin.role, action: "fornecedor.criado", subjectType: "supplier", subjectId: supplier.id, targetUserId: owner.id });
    return supplier.id;
  });
}

export async function addSupplierProduct(db: Db, admin: SessionUser, supplierId: string, input: { name: string; unit: string; priceCents: number }) {
  if (input.name.trim().length < 1 || input.unit.trim().length < 1) throw new DomainError("produto", "Indica o nome e a unidade.");
  if (!Number.isSafeInteger(input.priceCents) || input.priceCents <= 0) throw new DomainError("produto", "Indica o preço.");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [product] = await tx.insert(supplierProducts).values({ supplierId, name: input.name.trim(), unit: input.unit.trim(), priceCents: input.priceCents }).returning({ id: supplierProducts.id });
    await recordAudit(tx, { actorId: admin.id, actorRole: admin.role, action: "fornecedor.produto", subjectType: "supplier_product", subjectId: product.id, data: { supplierId, priceCents: input.priceCents } });
  });
}

export async function setSupplierProductActive(db: Db, supplierId: string, productId: string, active: boolean) {
  const rows = await db.update(supplierProducts).set({ active }).where(and(eq(supplierProducts.id, productId), eq(supplierProducts.supplierId, supplierId))).returning({ supplierId: supplierProducts.supplierId });
  if (rows[0]?.supplierId !== supplierId) throw new DomainError("produto", "Produto não encontrado.");
}

/** Site registrations join an agent's portfolio through an explicit, audited assignment by management. */
export async function assignMerchant(db: Db, admin: SessionUser, merchantId: string, agentId: string) {
  if (admin.role !== "admin") throw new DomainError("sem_permissao", "Só a gestão atribui comerciantes a agentes.");
  if (!z.uuid().safeParse(merchantId).success || !z.uuid().safeParse(agentId).success) throw new DomainError("agente", "Escolhe o comerciante e o agente.");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [business] = await tx.select().from(businesses).where(eq(businesses.ownerId, merchantId)).for("update");
    const [agent] = await tx.select().from(agents).where(and(eq(agents.id, agentId), eq(agents.status, "activo")));
    if (!business || !agent || business.marketId !== agent.marketId) throw new DomainError("agente", "Escolhe um agente activo do mercado do comerciante.");
    if (business.agentId === agentId) return;
    await tx.update(businesses).set({ agentId }).where(eq(businesses.id, business.id));
    await recordAudit(tx, { actorId: admin.id, actorRole: admin.role, action: "comerciante.agente_atribuido", subjectType: "business", subjectId: business.id, targetUserId: merchantId, data: { previousAgentId: business.agentId, agentId } });
  });
}

export async function changePassword(db: Db, user: SessionUser, current: string, next: string) {
  if (next.length < 12) throw new DomainError("palavra_passe", "A nova palavra-passe tem de ter pelo menos 12 caracteres.");
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!(await verifySecret(current, row?.passwordHash))) throw new DomainError("palavra_passe", "A palavra-passe actual está errada.");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    await tx.update(users).set({ passwordHash: await hashSecret(next) }).where(eq(users.id, user.id));
    await recordAudit(tx, { actorId: user.id, actorRole: user.role, action: "conta.palavra_passe", subjectType: "user", subjectId: user.id, targetUserId: user.id });
  });
}
