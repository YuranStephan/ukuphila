import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { can } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import type { Executor } from "../db/client";
import { creditApplications, creditContracts, creditInstalments, creditRepayments, supplierProducts, suppliers, users } from "../db/schema";
import { DomainError } from "../errors";

function assertSupplier(user: SessionUser) {
  if (!can(user.role, "supplier.portal")) throw new DomainError("sem_permissao", "Não tens acesso ao portal do fornecedor.");
}

export async function supplierProfile(db: Executor, user: SessionUser) {
  assertSupplier(user);
  const [supplier] = await db.select({ id: suppliers.id, name: suppliers.name, status: suppliers.status, category: suppliers.category })
    .from(suppliers).where(eq(suppliers.ownerId, user.id)).limit(1);
  return supplier ?? null;
}

/** Scope every read through the authenticated owner; never expose delivery codes or credit assessments. */
export async function supplierOrders(db: Executor, user: SessionUser) {
  assertSupplier(user);
  return db.select({
    id: creditContracts.id, code: creditContracts.code, status: creditContracts.status,
    merchant: users.displayName, principalCents: creditContracts.principalCents, feeCents: creditContracts.feeCents,
    termDays: creditContracts.termDays, acceptedAt: creditContracts.acceptedAt, deliveredAt: creditContracts.deliveredAt,
    items: creditApplications.items,
  }).from(creditContracts)
    .innerJoin(suppliers, eq(suppliers.id, creditContracts.supplierId))
    .innerJoin(users, eq(users.id, creditContracts.userId))
    .innerJoin(creditApplications, and(eq(creditApplications.id, creditContracts.applicationId), eq(creditApplications.supplierId, suppliers.id)))
    .where(eq(suppliers.ownerId, user.id)).orderBy(desc(creditContracts.createdAt));
}

export async function supplierCatalogue(db: Executor, user: SessionUser) {
  assertSupplier(user);
  return db.select({ id: supplierProducts.id, name: supplierProducts.name, unit: supplierProducts.unit, priceCents: supplierProducts.priceCents, active: supplierProducts.active })
    .from(supplierProducts).innerJoin(suppliers, eq(suppliers.id, supplierProducts.supplierId))
    .where(eq(suppliers.ownerId, user.id)).orderBy(asc(supplierProducts.name));
}

export async function supplierSettlements(db: Executor, user: SessionUser) {
  assertSupplier(user);
  const [instalments, payments] = await Promise.all([
    db.select({
      id: creditInstalments.id, code: creditContracts.code, merchant: users.displayName,
      number: creditInstalments.number, dueDate: creditInstalments.dueDate, amountCents: creditInstalments.amountCents,
      paidCents: creditInstalments.paidCents, status: creditInstalments.status, paidAt: creditInstalments.paidAt,
    }).from(creditInstalments)
      .innerJoin(creditContracts, eq(creditContracts.id, creditInstalments.contractId))
      .innerJoin(suppliers, eq(suppliers.id, creditContracts.supplierId))
      .innerJoin(users, eq(users.id, creditContracts.userId))
      .where(eq(suppliers.ownerId, user.id)).orderBy(asc(creditInstalments.dueDate), asc(creditInstalments.number)),
    db.select({
      id: creditRepayments.id, code: creditContracts.code, merchant: users.displayName,
      amountCents: creditRepayments.amountCents, method: creditRepayments.method,
      reference: creditRepayments.reference, paidAt: creditRepayments.paidAt,
    }).from(creditRepayments)
      .innerJoin(creditContracts, eq(creditContracts.id, creditRepayments.contractId))
      .innerJoin(suppliers, eq(suppliers.id, creditContracts.supplierId))
      .innerJoin(users, eq(users.id, creditContracts.userId))
      .where(eq(suppliers.ownerId, user.id)).orderBy(desc(creditRepayments.paidAt)),
  ]);
  return { instalments, payments };
}
