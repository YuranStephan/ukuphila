import "server-only";
import { NextResponse } from "next/server";
import { currentUser, type SessionUser } from "@/server/auth/session";
import { DomainError, publicMessage } from "@/server/errors";

/** Cookies are SameSite=Lax already; this refuses any write that does not come from our own pages. */
function sameOrigin(request?: Request) {
  if (!request || request.method === "GET") return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  } catch {
    return false;
  }
}

/** Merchant API guard: JSON 401 instead of a redirect, because the caller is the offline client. */
export async function merchantOr401(request?: Request): Promise<SessionUser | NextResponse> {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "A sessão terminou. Entra outra vez." }, { status: 401 });
  if (user.role !== "merchant") return NextResponse.json({ error: "Esta área é do comerciante." }, { status: 403 });
  return user;
}

export function jsonError(error: unknown) {
  if (error instanceof DomainError) return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
  return NextResponse.json({ error: publicMessage(error) }, { status: 500 });
}
