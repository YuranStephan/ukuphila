import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "ukuphila-dev-secret");

export function normalizarTelefone(raw: string) {
  return raw.replace(/\D/g, "");
}

export async function criarSessao(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  const jar = await cookies();
  jar.set("ukuphila_sessao", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function limparSessao() {
  const jar = await cookies();
  jar.delete("ukuphila_sessao");
}

export async function utilizadorActual() {
  const jar = await cookies();
  const token = jar.get("ukuphila_sessao")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    return prisma.user.findUnique({
      where: { id: payload.sub },
      include: { agente: true },
    });
  } catch {
    return null;
  }
}

export async function exigirUtilizador() {
  const u = await utilizadorActual();
  if (!u) {
    throw new Response(JSON.stringify({ erro: "Precisas de entrar primeiro." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return u;
}
