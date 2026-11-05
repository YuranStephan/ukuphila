import "server-only";
import { and, desc, eq, gt, isNull, lt, notInArray, sql } from "drizzle-orm";
import { agentProfile, assertAssigned } from "../agent/service";
import { normalizePhone } from "@/lib/phone";
import { recordAudit } from "../audit";
import { randomDigits, safeEqual, hmac, verifySecret, hashSecret } from "../crypto";
import type { Db, Tx } from "../db/client";
import { otpChallenges, users } from "../db/schema";
import { DomainError } from "../errors";
import { hitLimit } from "./service";
import type { SessionUser } from "./session";

/*
 * Signing in without SMS. The agent, standing next to the merchant, issues a one-time activation code; the merchant
 * types phone + code and chooses a PIN. Afterwards phone + PIN is enough. A forgotten or blocked PIN goes back to the
 * agent for a new code, which is exactly the human checkpoint the product wants for account recovery.
 */

const ACTIVATION_TTL_MS = 24 * 3_600_000;
const MAX_ATTEMPTS = 5;
const PIN_LIMIT = 5;

const codeHash = (phone: string, code: string) => hmac(`${phone}:${code}`, "activacao");

export async function issueActivationCode(db: Db, issuer: SessionUser, merchantId: string) {
  if (issuer.role !== "admin" && issuer.role !== "agent") throw new DomainError("sem_permissao", "Só a gestão ou o agente pode gerar um código de entrada.");
  if (issuer.role === "agent") await assertAssigned(db, (await agentProfile(db, issuer.id)).id, merchantId);
  const [merchant] = await db.select({ id: users.id, phone: users.phone, role: users.role, status: users.status }).from(users).where(eq(users.id, merchantId)).limit(1);
  if (!merchant?.phone || !["merchant", "agent", "supplier"].includes(merchant.role)) throw new DomainError("activacao", "Esta conta não entra com telefone.");
  if (merchant.status === "suspenso" || merchant.status === "encerrado") throw new DomainError("conta_suspensa", "Esta conta está suspensa ou encerrada.");
  if (merchant.role !== "merchant" && issuer.role !== "admin") throw new DomainError("sem_permissao", "Só a gestão gera códigos para agentes e fornecedores.");
  const code = randomDigits(8);
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`activacao:${merchant.phone}`}))`);
    // A new code cancels any earlier one: only the most recent piece of paper works.
    await tx.update(otpChallenges).set({ consumedAt: new Date() }).where(and(eq(otpChallenges.phone, merchant.phone as string), eq(otpChallenges.purpose, "activacao"), isNull(otpChallenges.consumedAt)));
    await tx.insert(otpChallenges).values({ phone: merchant.phone as string, purpose: "activacao", codeHash: codeHash(merchant.phone as string, code), expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS) });
    await recordAudit(tx, { actorId: issuer.id, actorRole: issuer.role, action: "conta.codigo_activacao", subjectType: "user", subjectId: merchantId, targetUserId: merchantId });
  });
  return code;
}

export type LoginStep = { phone: string; method: "pin" | "codigo"; name: string };

/** First step: which proof does this phone need? Same answer shape whether or not the account exists. */
export async function loginStep(db: Db, rawPhone: string): Promise<LoginStep> {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new DomainError("telefone", "Esse número não parece um telemóvel de Moçambique.");
  await hitLimit(db, `login-step:${phone}`, 20, 900);
  const [user] = await db.select({ name: users.displayName, pinHash: users.pinHash, pinFailures: users.pinFailures, status: users.status }).from(users).where(eq(users.phone, phone)).limit(1);
  if (!user) throw new DomainError("sem_conta", "Ainda não há conta com este número. Fala com o agente do teu mercado.");
  if (user.status === "suspenso" || user.status === "encerrado") throw new DomainError("conta_suspensa", "Esta conta está suspensa. Fala com o teu agente.");
  const method = user.pinHash && user.pinFailures < PIN_LIMIT ? "pin" : "codigo";
  return { phone, method, name: user.name.split(" ")[0] };
}

export async function signInWithPin(db: Db, phone: string, pin: string) {
  const normalized = normalizePhone(phone);
  if (!normalized || !/^\d{4,6}$/.test(pin)) throw new DomainError("pin", "Indica o telefone e um PIN de 4 a 6 números.");
  phone = normalized;
  await hitLimit(db, `pin:${phone}`, 10, 900);
  const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!user?.pinHash) throw new DomainError("pin", "Ainda não tens PIN. Pede um código ao teu agente.");
  if (user.status === "suspenso" || user.status === "encerrado") throw new DomainError("conta_suspensa", "Esta conta está suspensa ou encerrada.");
  if (user.pinFailures >= PIN_LIMIT) throw new DomainError("pin_bloqueado", "PIN bloqueado depois de várias tentativas. Pede um código novo ao teu agente.");
  if (!(await verifySecret(pin, user.pinHash))) {
    await db.update(users).set({ pinFailures: sql`${users.pinFailures} + 1` }).where(eq(users.id, user.id));
    const left = PIN_LIMIT - user.pinFailures - 1;
    throw new DomainError("pin_errado", left > 0 ? `PIN errado. Restam ${left} tentativas.` : "PIN bloqueado. Pede um código novo ao teu agente.");
  }
  const reset = await db.update(users).set({ pinFailures: 0, lastSeenAt: new Date() }).where(and(eq(users.id, user.id), lt(users.pinFailures, PIN_LIMIT), notInArray(users.status, ["suspenso", "encerrado"]))).returning({ id: users.id });
  if (!reset.length) throw new DomainError("pin_bloqueado", "Conta bloqueada. Fala com o teu agente.");
  return user;
}

/** Code + new PIN in one step, so an account is never left signed in without a PIN. */
export async function activateWithCode(db: Db, phone: string, code: string, pin: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new DomainError("telefone", "Indica um telemóvel de Moçambique.");
  phone = normalized;
  await hitLimit(db, `activacao:${phone}`, 10, 900);
  if (!/^\d{4,6}$/.test(pin) || /^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) {
    throw new DomainError("pin_fraco", "Escolhe um PIN de 4 a 6 números que não seja fácil de adivinhar.");
  }
  const [challenge] = await db
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.phone, phone), eq(otpChallenges.purpose, "activacao"), isNull(otpChallenges.consumedAt), gt(otpChallenges.expiresAt, new Date())))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);
  if (!challenge || challenge.attempts >= MAX_ATTEMPTS) throw new DomainError("codigo", "O código expirou ou já foi usado. Pede um novo ao teu agente.");
  if (!safeEqual(challenge.codeHash, codeHash(phone, code.replace(/\s/g, "")))) {
    await db.update(otpChallenges).set({ attempts: sql`${otpChallenges.attempts} + 1` }).where(eq(otpChallenges.id, challenge.id));
    throw new DomainError("codigo", "Código errado. Confirma os 8 números.");
  }
  const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!user) throw new DomainError("sem_conta", "Conta não encontrada.");
  if (user.status === "suspenso" || user.status === "encerrado") throw new DomainError("conta_suspensa", "Esta conta está suspensa ou encerrada.");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`activacao:${phone}`}))`);
    const consumed = await tx.update(otpChallenges).set({ consumedAt: new Date() }).where(and(eq(otpChallenges.id, challenge.id), isNull(otpChallenges.consumedAt), gt(otpChallenges.expiresAt, new Date()), lt(otpChallenges.attempts, MAX_ATTEMPTS))).returning({ id: otpChallenges.id });
    if (!consumed.length) throw new DomainError("codigo", "O código expirou ou já foi usado. Pede um novo ao teu agente.");
    await tx.update(users).set({ pinHash: await hashSecret(pin), pinFailures: 0, status: user.status === "preliminar" ? "activo" : user.status, lastSeenAt: new Date() }).where(eq(users.id, user.id));
    await recordAudit(tx, { actorId: user.id, actorRole: user.role, action: "conta.activada", subjectType: "user", subjectId: user.id, targetUserId: user.id });
  });
  return user;
}
