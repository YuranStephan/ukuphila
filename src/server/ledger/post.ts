import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { canonicalJson, GENESIS_HASH } from "@/lib/canonical";
import { sha256 } from "../crypto";
import type { Executor, Tx } from "../db/client";
import { accounts, journalEntries, postings, type AccountCode, type Channel, type EntryKind } from "../db/schema";
import { DomainError } from "../errors";
import { accountMap, ensureAccounts } from "./accounts";

export type EntryLine = { account: AccountCode; amountCents: number };

export type EntryInput = {
  userId: string;
  kind: EntryKind;
  occurredAt: Date;
  channel: Channel;
  recordedBy: string;
  opId?: string | null;
  amountCents: number;
  category?: string | null;
  memo?: string | null;
  productId?: string | null;
  quantity?: number | null;
  customerId?: string | null;
  goalId?: string | null;
  refType?: string | null;
  refId?: string | null;
  reversesId?: string | null;
  needsReview?: boolean;
  reviewNote?: string | null;
  lines: EntryLine[];
};

export function assertBalanced(lines: EntryLine[]) {
  const total = lines.reduce((sum, line) => sum + line.amountCents, 0);
  if (total !== 0 || lines.length < 2) throw new DomainError("lancamento", "Lançamento não balanceado.");
}

export function computeEntryHash(input: {
  prevHash: string;
  seq: number;
  userId: string;
  kind: string;
  occurredAt: Date;
  amountCents: number;
  opId: string | null;
  reversesId: string | null;
  lines: EntryLine[];
}) {
  return sha256(
    canonicalJson({
      prevHash: input.prevHash,
      seq: input.seq,
      userId: input.userId,
      kind: input.kind,
      occurredAt: input.occurredAt.toISOString(),
      amountCents: input.amountCents,
      opId: input.opId,
      reversesId: input.reversesId,
      lines: [...input.lines].sort((a, b) => a.account.localeCompare(b.account) || a.amountCents - b.amountCents),
    }),
  );
}

/**
 * The only way money is recorded. Inside the caller's transaction it locks the person's chain, links the entry to the
 * previous hash and writes balanced postings. Corrections go through reverseEntry; nothing is ever updated.
 */
export async function postEntry(tx: Tx, input: EntryInput) {
  assertBalanced(input.lines);
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new DomainError("valor", "O valor tem de ser maior que zero.");
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ukuphila:ledger:${input.userId}`}))`);
  const [last] = await tx
    .select({ seq: journalEntries.seq, hash: journalEntries.hash })
    .from(journalEntries)
    .where(eq(journalEntries.userId, input.userId))
    .orderBy(desc(journalEntries.seq))
    .limit(1);
  const seq = (last?.seq ?? 0) + 1;
  const prevHash = last?.hash ?? GENESIS_HASH;
  const hash = computeEntryHash({
    prevHash,
    seq,
    userId: input.userId,
    kind: input.kind,
    occurredAt: input.occurredAt,
    amountCents: input.amountCents,
    opId: input.opId ?? null,
    reversesId: input.reversesId ?? null,
    lines: input.lines,
  });
  const [entry] = await tx
    .insert(journalEntries)
    .values({
      userId: input.userId,
      seq,
      kind: input.kind,
      occurredAt: input.occurredAt,
      channel: input.channel,
      recordedBy: input.recordedBy,
      opId: input.opId ?? null,
      amountCents: input.amountCents,
      category: input.category ?? null,
      memo: input.memo ?? null,
      productId: input.productId ?? null,
      quantity: input.quantity ?? null,
      customerId: input.customerId ?? null,
      goalId: input.goalId ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      reversesId: input.reversesId ?? null,
      needsReview: input.needsReview ?? false,
      reviewNote: input.reviewNote ?? null,
      prevHash,
      hash,
    })
    .returning();
  let ids = await accountMap(tx, input.userId);
  if (ids.size === 0) {
    await ensureAccounts(tx, input.userId);
    ids = await accountMap(tx, input.userId);
  }
  await tx.insert(postings).values(
    input.lines.map((line) => {
      const accountId = ids.get(line.account);
      if (!accountId) throw new DomainError("conta", `Conta ${line.account} em falta.`);
      return { entryId: entry.id, accountId, amountCents: line.amountCents };
    }),
  );
  return entry;
}

/** Recomputes one person's chain from the stored postings. Any edit behind the triggers' back breaks a link here. */
export async function verifyLedgerChain(db: Executor, userId: string) {
  const entries = await db.select().from(journalEntries).where(eq(journalEntries.userId, userId)).orderBy(asc(journalEntries.seq));
  const lines = await db
    .select({ entryId: postings.entryId, code: accounts.code, amountCents: postings.amountCents })
    .from(postings)
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .where(eq(accounts.userId, userId));
  const byEntry = new Map<string, EntryLine[]>();
  for (const line of lines) {
    const list = byEntry.get(line.entryId) ?? [];
    list.push({ account: line.code, amountCents: line.amountCents });
    byEntry.set(line.entryId, list);
  }
  let prevHash = GENESIS_HASH;
  for (const entry of entries) {
    const expected = computeEntryHash({
      prevHash,
      seq: entry.seq,
      userId,
      kind: entry.kind,
      occurredAt: entry.occurredAt,
      amountCents: entry.amountCents,
      opId: entry.opId,
      reversesId: entry.reversesId,
      lines: byEntry.get(entry.id) ?? [],
    });
    if (entry.prevHash !== prevHash || entry.hash !== expected) return { valid: false as const, checked: entries.length, brokenAtSeq: entry.seq };
    prevHash = entry.hash;
  }
  return { valid: true as const, checked: entries.length, head: prevHash };
}
