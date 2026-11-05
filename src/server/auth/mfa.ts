import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "../audit";
import { generateTotpSecret, openText, sealText, sha256, verifyTotp } from "../crypto";
import type { Db, Tx } from "../db/client";
import { users } from "../db/schema";
import { DomainError } from "../errors";

type Staff = typeof users.$inferSelect;
export type MfaChallenge = { token: string; secret: string };
const challenge = z.object({ userId: z.uuid(), password: z.string(), secret: z.string().regex(/^[A-Z2-7]{20,64}$/), expiresAt: z.number().int() });

/** Called only after password verification; nothing is activated until the authenticator proves it has the key. */
export function prepareMfa(user: Staff): MfaChallenge {
  if (!user.passwordHash || user.kind !== "staff" || user.totpEnabledAt) throw new DomainError("mfa", "Esta conta não pode iniciar esta configuração.");
  const secret = generateTotpSecret();
  return { secret, token: sealText(JSON.stringify({ userId: user.id, password: sha256(user.passwordHash), secret, expiresAt: Date.now() + 10 * 60_000 })) };
}

export async function completeMfa(db: Db, user: Staff, token: string, code: string) {
  let data: z.infer<typeof challenge>;
  try { data = challenge.parse(JSON.parse(openText(token))); } catch { throw new DomainError("mfa", "Configuração inválida. Começa novamente."); }
  if (data.userId !== user.id || data.password !== sha256(user.passwordHash ?? "") || data.expiresAt <= Date.now()) throw new DomainError("mfa", "A configuração expirou. Começa novamente.");
  if (!/^\d{6}$/.test(code) || !verifyTotp(data.secret, code)) throw new DomainError("mfa", "Código errado. Confirma o código na aplicação de autenticação.");
  return db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [current] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
    if (!current || current.kind !== "staff" || current.status !== "activo" || current.totpEnabledAt || current.passwordHash !== user.passwordHash) throw new DomainError("mfa", "A conta mudou. Entra novamente.");
    const [updated] = await tx.update(users).set({ totpSecret: sealText(data.secret), totpEnabledAt: new Date() }).where(eq(users.id, user.id)).returning();
    await recordAudit(tx, { actorId: user.id, actorRole: user.role, action: "conta.mfa_activada", subjectType: "user", subjectId: user.id, targetUserId: user.id });
    return updated;
  });
}
