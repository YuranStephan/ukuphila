import "server-only";
import { asc, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { can } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import type { Executor } from "../db/client";
import { accessLog, creditPolicies, riskAlerts, riskCaseNotes, riskCases, users } from "../db/schema";
import { DomainError } from "../errors";

/** Record each merchant once per risk view; aggregate-only views contain no personal data. */
export async function logRiskViews(db: Executor, viewer: SessionUser, subjectIds: (string | null)[], resource: string) {
  if (!can(viewer.role, "risk.read")) throw new DomainError("sem_permissao", "Não tens acesso à sala de risco.");
  const ids = [...new Set(subjectIds.filter((id): id is string => id !== null))];
  if (ids.length) await db.insert(accessLog).values(ids.map((subjectId) => ({
    subjectId, actorId: viewer.id, actorRole: viewer.role, purpose: "Acompanhamento de risco", resource,
  })));
}

export async function creditPolicyHistory(db: Executor) {
  return db.select().from(creditPolicies).orderBy(desc(creditPolicies.createdAt));
}

export async function listCases(db: Executor, closed = false) {
  return db.select({ item: riskCases, subject: users.displayName }).from(riskCases)
    .leftJoin(users, eq(users.id, riskCases.subjectUserId))
    .where(closed ? eq(riskCases.status, "fechado") : ne(riskCases.status, "fechado"))
    .orderBy(desc(riskCases.createdAt)).limit(100);
}

export async function caseDetail(db: Executor, caseId: string) {
  if (!z.uuid().safeParse(caseId).success) return null;
  const [item] = await db.select({ record: riskCases, subject: users.displayName }).from(riskCases)
    .leftJoin(users, eq(users.id, riskCases.subjectUserId)).where(eq(riskCases.id, caseId));
  if (!item) return null;
  const [notes, alerts] = await Promise.all([
    db.select({ note: riskCaseNotes, author: users.displayName }).from(riskCaseNotes).innerJoin(users, eq(users.id, riskCaseNotes.actorId)).where(eq(riskCaseNotes.caseId, caseId)).orderBy(asc(riskCaseNotes.createdAt)),
    db.select().from(riskAlerts).where(eq(riskAlerts.caseId, caseId)).orderBy(asc(riskAlerts.createdAt)),
  ]);
  return { item: item.record, subject: item.subject, notes, alerts };
}
