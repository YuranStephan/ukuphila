import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { canonicalJson } from "@/lib/canonical";
import { PASSPORT_SECTIONS } from "@/lib/labels";
import { recordAudit } from "./audit";
import type { SessionUser } from "./auth/session";
import { hmac, randomCode, safeEqual } from "./crypto";
import { rowsOf, type Db, type Tx } from "./db/client";
import { businesses, kycProfiles, markets, passports, users } from "./db/schema";
import { DomainError } from "./errors";
import { trustFor } from "./trust/facts";

/*
 * The history belongs to the merchant. A passport is a signed, expiring snapshot that they choose to show a supplier or
 * a lender: they pick the sections, it never reveals documents or exact balances, and they can revoke it at any time.
 */

const MAX_DAYS = 90;

function salesBand(cents: number) {
  const meticais = cents / 100;
  if (meticais < 10_000) return "Até 10 mil MT por mês";
  if (meticais < 30_000) return "10 a 30 mil MT por mês";
  if (meticais < 75_000) return "30 a 75 mil MT por mês";
  if (meticais < 150_000) return "75 a 150 mil MT por mês";
  return "Mais de 150 mil MT por mês";
}

export async function buildPassportSnapshot(db: Db, userId: string, scope: string[]) {
  const trust = await trustFor(db, userId);
  const { facts } = trust;
  const [profile] = await db
    .select({ name: users.displayName, activity: businesses.activity, market: markets.name, level: kycProfiles.level })
    .from(users)
    .innerJoin(businesses, eq(businesses.ownerId, users.id))
    .innerJoin(markets, eq(markets.id, businesses.marketId))
    .leftJoin(kycProfiles, eq(kycProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  const [sales] = rowsOf<{ total: string }>(
    await db.execute(sql`
      select coalesce(sum(amount_cents), 0) as total from journal_entries e
      where e.user_id = ${userId} and e.kind in ('venda','venda_fiado') and e.occurred_at >= now() - interval '30 days'
        and not exists (select 1 from journal_entries r where r.reverses_id = e.id)
    `),
  );
  const snapshot: Record<string, unknown> = { generatedAt: new Date().toISOString(), policyVersion: trust.policyVersion };
  if (scope.includes("identidade")) snapshot.identidade = { name: profile.name, market: profile.market, activity: profile.activity };
  if (scope.includes("verificacao")) snapshot.verificacao = { level: profile.level ?? 0 };
  if (scope.includes("actividade")) snapshot.actividade = { months: facts.monthsActive, activeDays90: facts.activeDays90 };
  if (scope.includes("volume")) snapshot.volume = { band: salesBand(Number(sales?.total ?? 0)) };
  if (scope.includes("poupanca")) snapshot.poupanca = { months6: facts.savingsMonths6 };
  if (scope.includes("xitique")) snapshot.xitique = { due: facts.xitiqueDue, onTime: facts.xitiqueOnTime };
  if (scope.includes("credito")) snapshot.credito = { due: facts.creditInstalmentsDue, onTime: facts.creditInstalmentsOnTime, settled: facts.supplierContractsSettled, overdue: facts.creditOverdue };
  return snapshot;
}

function sign(code: string, userId: string, snapshot: unknown) {
  return hmac(canonicalJson({ code, userId, snapshot }), "passport");
}

export async function issuePassport(db: Db, user: SessionUser, input: { audience: string; scope: string[]; days: number }) {
  const scope = input.scope.filter((section) => PASSPORT_SECTIONS[section]);
  if (scope.length === 0) throw new DomainError("passaporte", "Escolhe pelo menos uma coisa para mostrar.");
  if (!input.audience.trim()) throw new DomainError("passaporte", "Diz para quem é este passaporte.");
  const days = Math.min(Math.max(input.days, 1), MAX_DAYS);
  const snapshot = await buildPassportSnapshot(db, user.id, scope);
  const code = randomCode(10);
  return db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [passport] = await tx
      .insert(passports)
      .values({ userId: user.id, code, audience: input.audience.trim().slice(0, 80), scope, snapshot, signature: sign(code, user.id, snapshot), expiresAt: new Date(Date.now() + days * 86_400_000) })
      .returning();
    await recordAudit(tx, { actorId: user.id, actorRole: user.role, action: "passaporte.emitido", subjectType: "passport", subjectId: passport.id, targetUserId: user.id, data: { scope, days } });
    return passport;
  });
}

export async function revokePassport(db: Db, user: SessionUser, passportId: string) {
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const rows = await tx
      .update(passports)
      .set({ revokedAt: new Date() })
      .where(and(eq(passports.id, passportId), eq(passports.userId, user.id), isNull(passports.revokedAt)))
      .returning({ id: passports.id });
    if (rows.length) await recordAudit(tx, { actorId: user.id, actorRole: user.role, action: "passaporte.revogado", subjectType: "passport", subjectId: passportId, targetUserId: user.id });
  });
}

export type PassportView = { state: "valido" | "expirado" | "revogado" | "adulterado"; audience?: string; snapshot?: Record<string, unknown>; scope?: string[]; expiresAt?: Date; createdAt?: Date };

/** Public verification. The signature is rechecked on every read, and a dead passport shows no data at all. */
export async function verifyPassport(db: Db, code: string): Promise<PassportView | null> {
  const [passport] = await db.select().from(passports).where(eq(passports.code, code.trim().toUpperCase())).limit(1);
  if (!passport) return null;
  if (!safeEqual(passport.signature, sign(passport.code, passport.userId, passport.snapshot))) return { state: "adulterado" };
  if (passport.revokedAt) return { state: "revogado" };
  if (passport.expiresAt.getTime() < Date.now()) return { state: "expirado" };
  await db.update(passports).set({ views: sql`${passports.views} + 1` }).where(eq(passports.id, passport.id));
  return { state: "valido", audience: passport.audience, snapshot: passport.snapshot as Record<string, unknown>, scope: passport.scope, expiresAt: passport.expiresAt, createdAt: passport.createdAt };
}
