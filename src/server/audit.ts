import "server-only";
import { desc, sql } from "drizzle-orm";
import { canonicalJson, GENESIS_HASH } from "@/lib/canonical";
import { sha256 } from "./crypto";
import type { Executor, Tx } from "./db/client";
import { auditEvents } from "./db/schema";

export type AuditInput = {
  actorId: string | null;
  actorRole: string;
  action: string;
  subjectType: string;
  subjectId?: string | null;
  targetUserId?: string | null;
  data?: Record<string, unknown> | null;
};

function auditHash(prevHash: string, event: AuditInput, at: string) {
  return sha256(
    canonicalJson({
      prevHash,
      at,
      actorId: event.actorId,
      actorRole: event.actorRole,
      action: event.action,
      subjectType: event.subjectType,
      subjectId: event.subjectId ?? null,
      targetUserId: event.targetUserId ?? null,
      data: event.data ?? null,
    }),
  );
}

/** Appends to the hash chain. The advisory lock keeps concurrent writers from forking it. */
export async function recordAudit(tx: Tx, event: AuditInput) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('ukuphila:audit'))`);
  const [last] = await tx.select({ hash: auditEvents.hash }).from(auditEvents).orderBy(desc(auditEvents.seq)).limit(1);
  const prevHash = last?.hash ?? GENESIS_HASH;
  const at = new Date();
  await tx.insert(auditEvents).values({
    actorId: event.actorId,
    actorRole: event.actorRole,
    action: event.action,
    subjectType: event.subjectType,
    subjectId: event.subjectId ?? null,
    targetUserId: event.targetUserId ?? null,
    data: event.data ?? null,
    prevHash,
    hash: auditHash(prevHash, event, at.toISOString()),
    at,
  });
}

/** Recomputes the chain so an auditor can prove nothing was altered. Returns the first broken link, if any. */
export async function verifyAuditChain(db: Executor, limit = 5000) {
  const rows = await db.select().from(auditEvents).orderBy(auditEvents.seq).limit(limit);
  let prevHash = GENESIS_HASH;
  for (const row of rows) {
    const expected = auditHash(
      prevHash,
      {
        actorId: row.actorId,
        actorRole: row.actorRole,
        action: row.action,
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        targetUserId: row.targetUserId,
        data: row.data as Record<string, unknown> | null,
      },
      row.at.toISOString(),
    );
    if (row.prevHash !== prevHash || row.hash !== expected) return { valid: false as const, checked: rows.length, brokenAt: row.seq };
    prevHash = row.hash;
  }
  return { valid: true as const, checked: rows.length, head: prevHash };
}
