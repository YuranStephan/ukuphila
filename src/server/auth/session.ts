import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { randomToken, sha256 } from "../crypto";
import { getDb, type Db, type Executor } from "../db/client";
import { sessions, users, type Role, type UserKind } from "../db/schema";
import { DomainError } from "../errors";
import { isProduction } from "../env";
import { can, type Capability } from "./permissions";

const COOKIE = "uk_session";
const MERCHANT_DAYS = 60;
const STAFF_HOURS = 12;

export type SessionUser = {
  id: string;
  kind: UserKind;
  role: Role;
  displayName: string;
  phone: string | null;
  email: string | null;
  isDemo: boolean;
  sessionId: string;
  deviceId: string | null;
};

export async function createSession(db: Executor, userId: string, role: Role, opts: { deviceId?: string | null; mfa?: boolean } = {}) {
  const token = randomToken();
  const fieldRole = role === "merchant" || role === "agent" || role === "supplier";
  const ttl = fieldRole ? MERCHANT_DAYS * 86_400_000 : STAFF_HOURS * 3_600_000;
  const expiresAt = new Date(Date.now() + ttl);
  const requestHeaders = await headers();
  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    deviceId: opts.deviceId ?? null,
    userAgent: requestHeaders.get("user-agent")?.slice(0, 200) ?? null,
    mfaAt: opts.mfa ? new Date() : null,
    expiresAt,
  });
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: isProduction(), path: "/", expires: expiresAt });
  return token;
}

export async function resolveToken(db: Executor, token: string): Promise<SessionUser | null> {
  const [row] = await db
    .select({
      id: users.id,
      kind: users.kind,
      role: users.role,
      displayName: users.displayName,
      phone: users.phone,
      email: users.email,
      isDemo: users.isDemo,
      status: users.status,
      sessionId: sessions.id,
      deviceId: sessions.deviceId,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.status === "suspenso" || row.status === "encerrado") return null;
  const { status: _status, ...user } = row;
  return user;
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return resolveToken(await getDb(), token);
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, sha256(token)));
  }
  jar.delete(COOKIE);
}

/** For Server Components: bounces to sign-in, then shows the 403 page when the role does not fit. */
export async function requirePage(capabilityOrRoles: Capability | Role[], next?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  const allowed = Array.isArray(capabilityOrRoles) ? capabilityOrRoles.includes(user.role) : can(user.role, capabilityOrRoles);
  if (!allowed) forbidden();
  return user;
}

/** For Server Actions and route handlers: the same check, as an error the caller reports. */
export async function requireApi(capabilityOrRoles: Capability | Role[]): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new DomainError("sem_sessao", "A sessão terminou. Entra outra vez.");
  const allowed = Array.isArray(capabilityOrRoles) ? capabilityOrRoles.includes(user.role) : can(user.role, capabilityOrRoles);
  if (!allowed) throw new DomainError("sem_permissao", "Não tens permissão para esta acção.");
  return user;
}

export async function revokeAllSessions(db: Db, userId: string) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
