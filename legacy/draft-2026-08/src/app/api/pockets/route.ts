import { exigirUtilizador } from "@/lib/auth";
import { json, jsonErro } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await exigirUtilizador();
    const pockets = await prisma.pocket.findMany({ where: { userId: user.id } });
    return json(pockets);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const user = await exigirUtilizador();
    const url = new URL(req.url);
    if (!url.pathname.endsWith("/transfer") && !url.pathname.includes("/transfer")) {
      return jsonErro("Usa /pockets/transfer para mover dinheiro.");
    }
    return transferir(user.id, await req.json());
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function transferir(userId: string, body: { de?: string; para?: string; valor?: number; client_uuid?: string }) {
  const de = body.de === "casa" ? "casa" : "negocio";
  const para = body.para === "casa" ? "casa" : "negocio";
  const valor = Math.round(Number(body.valor || 0));
  if (de === para) return jsonErro("Escolhe dois bolsos diferentes.");
  if (valor <= 0) return jsonErro("Diz quanto queres mover.");

  const origem = await prisma.pocket.findFirst({ where: { userId, tipo: de } });
  const destino = await prisma.pocket.findFirst({ where: { userId, tipo: para } });
  if (!origem || !destino) return jsonErro("Não encontrámos os bolsos.");
  if (origem.saldoAtual < valor) {
    return jsonErro("Neste bolso não há tanto dinheiro para mover.");
  }

  const uuid = String(body.client_uuid || crypto.randomUUID());
  const existente = await prisma.transaction.findUnique({ where: { clientUuid: uuid } });
  if (existente) return json({ ok: true, duplicado: true });

  await prisma.$transaction([
    prisma.pocket.update({ where: { id: origem.id }, data: { saldoAtual: { decrement: valor } } }),
    prisma.pocket.update({ where: { id: destino.id }, data: { saldoAtual: { increment: valor } } }),
    prisma.transaction.create({
      data: {
        userId,
        pocketId: origem.id,
        tipo: "compra",
        valor,
        metodoRegisto: "texto",
        clientUuid: uuid + "-saida",
        nota: `Moveu para ${para === "casa" ? "Casa" : "Negócio"}`,
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        pocketId: destino.id,
        tipo: "venda",
        valor,
        metodoRegisto: "texto",
        clientUuid: uuid + "-entrada",
        nota: `Veio de ${de === "casa" ? "Casa" : "Negócio"}`,
      },
    }),
  ]);

  const pockets = await prisma.pocket.findMany({ where: { userId } });
  return json({ ok: true, pockets });
}
