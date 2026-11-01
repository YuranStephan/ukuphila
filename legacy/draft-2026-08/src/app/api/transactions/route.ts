import { exigirUtilizador } from "@/lib/auth";
import { json, jsonErro } from "@/lib/http";
import { prisma } from "@/lib/db";
import { periodoRange } from "@/lib/format";
import { aplicarTransacao } from "@/lib/sync";

export async function GET(req: Request) {
  try {
    const user = await exigirUtilizador();
    const { searchParams } = new URL(req.url);
    const pocket = searchParams.get("pocket");
    const periodo = searchParams.get("periodo") || "hoje";
    const produtoId = searchParams.get("produto");
    const { start } = periodoRange(periodo);

    const pockets = await prisma.pocket.findMany({ where: { userId: user.id } });
    const pocketId =
      pocket === "negocio" || pocket === "casa"
        ? pockets.find((p) => p.tipo === pocket)?.id
        : pocket || undefined;

    const list = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        criadoEm: { gte: start },
        ...(pocketId ? { pocketId } : {}),
        ...(produtoId ? { produtoId } : {}),
      },
      orderBy: { criadoEm: "desc" },
      include: { produto: true, pocket: true },
    });
    return json(list);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const user = await exigirUtilizador();
    const body = await req.json();
    const tipo = body.tipo === "compra" ? "compra" : "venda";
    const valor = Math.round(Number(body.valor || 0));
    if (valor <= 0) return jsonErro("Diz o valor em meticais.");

    let pocketId = String(body.pocket_id || "");
    if (body.pocket === "casa" || body.pocket === "negocio") {
      const p = await prisma.pocket.findFirst({
        where: { userId: user.id, tipo: body.pocket },
      });
      pocketId = p?.id || "";
    }
    if (!pocketId) return jsonErro("Escolhe o bolso.");

    const result = await aplicarTransacao({
      userId: user.id,
      pocketId,
      tipo,
      valor,
      produtoId: body.produto_id || null,
      metodoRegisto: body.metodo_registo || "texto",
      clientUuid: String(body.client_uuid || crypto.randomUUID()),
      quantidadeExtra: body.quantidade != null ? Number(body.quantidade) : null,
    });
    return json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return jsonErro(e.message);
    throw e;
  }
}
