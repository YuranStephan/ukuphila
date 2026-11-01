import "server-only";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { normalizePhone } from "@/lib/phone";
import { recordAudit } from "../audit";
import { hashSecret, hmac, openText, randomDigits, safeEqual, verifySecret, verifyTotp } from "../crypto";
import type { Db, Executor, Tx } from "../db/client";
import { businesses, kycProfiles, otpChallenges, rateLimits, users } from "../db/schema";
import { DomainError } from "../errors";
import { isDemo, isProduction } from "../env";
import { ensureAccounts } from "../ledger/accounts";
import { STRONG_AUTH_ROLES } from "./permissions";

const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const PIN_MAX_FAILURES = 5;

/** Atomic fixed-window counter in Postgres, so the limit holds across serverless instances. */
export async function hitLimit(db: Executor, key: string, max: number, windowSeconds: number) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowSeconds * 1000);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} < ${cutoff.toISOString()}::timestamptz then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${rateLimits.windowStart} < ${cutoff.toISOString()}::timestamptz then ${now.toISOString()}::timestamptz else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count });
  if (row.count > max) throw new DomainError("limite", "Muitas tentativas. Espera um pouco e tenta outra vez.");
}

function otpHash(phone: string, code: string) {
  return hmac(`${phone}:${code}`, "otp");
}

/**
 * Creates a one-time code. The caller delivers it through the configured channel; only outside production
 * (or in demo mode, for seeded numbers) is the code returned so it can appear on screen.
 */
export async function requestOtp(db: Db, rawPhone: string, purpose: "entrar" | "registo") {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new DomainError("telefone", "Esse número não parece um telemóvel de Moçambique.");
  await hitLimit(db, `otp:${phone}`, 5, 3600);
  const code = randomDigits(6);
  await db.insert(otpChallenges).values({
    phone,
    purpose,
    codeHash: otpHash(phone, code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  const [existing] = await db.select({ isDemo: users.isDemo }).from(users).where(eq(users.phone, phone)).limit(1);
  const reveal = !isProduction() || (isDemo() && (existing?.isDemo ?? true));
  return { phone, code, reveal };
}

export async function verifyOtp(db: Db, phone: string, code: string) {
  const [challenge] = await db
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.phone, phone), isNull(otpChallenges.consumedAt), gt(otpChallenges.expiresAt, new Date())))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);
  if (!challenge || challenge.attempts >= OTP_MAX_ATTEMPTS) throw new DomainError("otp", "O código expirou. Pede um novo.");
  if (!safeEqual(challenge.codeHash, otpHash(phone, code))) {
    await db.update(otpChallenges).set({ attempts: challenge.attempts + 1 }).where(eq(otpChallenges.id, challenge.id));
    throw new DomainError("otp", "Código errado. Confirma e tenta outra vez.");
  }
  await db.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, challenge.id));
}

export type NewMerchant = {
  phone: string;
  displayName: string;
  businessName: string;
  marketId: string;
  activity: string;
  category: string;
  stall?: string | null;
  agentId?: string | null;
  altContact?: string | null;
  status?: "preliminar" | "activo";
  isDemo?: boolean;
};

/** One phone, one identity (KB §28). Creating the person also opens the books. */
export async function createMerchant(tx: Tx, input: NewMerchant, actor: { id: string | null; role: string }) {
  const [user] = await tx
    .insert(users)
    .values({
      kind: "merchant",
      role: "merchant",
      phone: input.phone,
      displayName: input.displayName,
      status: input.status ?? "preliminar",
      isDemo: input.isDemo ?? false,
    })
    .onConflictDoNothing({ target: users.phone })
    .returning();
  if (!user) throw new DomainError("telefone_em_uso", "Este número já tem conta Ukuphila.");
  await tx.insert(kycProfiles).values({ userId: user.id, level: 0, status: "por_iniciar" });
  await tx.insert(businesses).values({
    ownerId: user.id,
    agentId: input.agentId ?? null,
    marketId: input.marketId,
    name: input.businessName,
    activity: input.activity,
    category: input.category,
    stall: input.stall ?? null,
    altContact: input.altContact ?? null,
  });
  await ensureAccounts(tx, user.id);
  await recordAudit(tx, {
    actorId: actor.id ?? user.id,
    actorRole: actor.role,
    action: "comerciante.criado",
    subjectType: "user",
    subjectId: user.id,
    targetUserId: user.id,
    data: { marketId: input.marketId, agentId: input.agentId ?? null },
  });
  return user;
}

export async function verifyStaffPassword(db: Db, rawEmail: string, password: string) {
  const email = rawEmail.trim().toLowerCase();
  await hitLimit(db, `login:${email}`, 8, 900);
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Same work and same message whether or not the account exists.
  const valid = await verifySecret(password, user?.passwordHash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
  if (!user || !valid) throw new DomainError("credenciais", "Email ou palavra-passe errados.");
  if (user.status === "suspenso" || user.status === "encerrado") throw new DomainError("conta_suspensa", "Esta conta está suspensa.");
  return user;
}

export function needsTotp(user: typeof users.$inferSelect) {
  return Boolean(user.totpEnabledAt && user.totpSecret);
}

/** Strong authentication is mandatory for administrative roles in a real operation (KB §29). */
export function mustEnrolTotp(user: typeof users.$inferSelect) {
  return STRONG_AUTH_ROLES.includes(user.role) && !user.totpEnabledAt && !isDemo() && isProduction();
}

export function checkTotp(user: typeof users.$inferSelect, code: string) {
  return Boolean(user.totpSecret) && verifyTotp(openText(user.totpSecret as string), code);
}

export async function setPin(db: Db, userId: string, pin: string) {
  if (!/^\d{4,6}$/.test(pin) || /^(\d)\1+$/.test(pin) || "0123456789".includes(pin)) {
    throw new DomainError("pin_fraco", "Escolhe um PIN de 4 a 6 números que não seja fácil de adivinhar.");
  }
  await db.update(users).set({ pinHash: await hashSecret(pin), pinFailures: 0 }).where(eq(users.id, userId));
}

/** Step-up check before sensitive acts such as accepting a contract. Five failures fall back to a new code. */
export async function checkPin(db: Db, userId: string, pin: string) {
  const [user] = await db.select({ pinHash: users.pinHash, pinFailures: users.pinFailures }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.pinHash) throw new DomainError("sem_pin", "Ainda não criaste um PIN. Cria um no teu perfil.");
  if (user.pinFailures >= PIN_MAX_FAILURES) throw new DomainError("pin_bloqueado", "PIN bloqueado. Entra outra vez com o código por mensagem.");
  if (!(await verifySecret(pin, user.pinHash))) {
    await db.update(users).set({ pinFailures: user.pinFailures + 1 }).where(eq(users.id, userId));
    throw new DomainError("pin_errado", "PIN errado.");
  }
  if (user.pinFailures > 0) await db.update(users).set({ pinFailures: 0 }).where(eq(users.id, userId));
}
