import { prisma } from "@/lib/db";
import { json, jsonErro } from "@/lib/http";
import { criarSessao, normalizarTelefone } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const telefone = normalizarTelefone(String(body.telefone || ""));
  const codigo = String(body.codigo || "").replace(/\s/g, "");

  const desafio = await prisma.otpChallenge.findFirst({
    where: { telefone, codigo, usado: false, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
  });

  if (!desafio) {
    return jsonErro("Este código já não serve. Pede outro e tenta outra vez.");
  }

  await prisma.otpChallenge.update({ where: { id: desafio.id }, data: { usado: true } });

  let user = await prisma.user.findUnique({ where: { telefone } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        telefone,
        nome: "Nova vendedora",
        nivelKyc: 1,
        pockets: {
          create: [
            { tipo: "negocio", saldoAtual: 0 },
            { tipo: "casa", saldoAtual: 0 },
          ],
        },
      },
    });
  }

  await criarSessao(user.id);
  return json({ ok: true, user: { id: user.id, nome: user.nome, telefone: user.telefone } });
}
