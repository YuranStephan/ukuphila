import { exigirUtilizador } from "@/lib/auth";
import { json, jsonErro } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await exigirUtilizador();
    const items = await prisma.inventoryItem.findMany({
      where: { userId: user.id },
      orderBy: { quantidadeAtual: "asc" },
    });
    return json(
      items.map((i) => ({
        ...i,
        stock_baixo: i.quantidadeAtual <= i.limiarStockBaixo,
      })),
    );
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const user = await exigirUtilizador();
    const body = await req.json();
    const nome = String(body.nome_produto || "").trim();
    if (!nome) return jsonErro("Diz o nome do produto.");
    const item = await prisma.inventoryItem.create({
      data: {
        userId: user.id,
        nomeProduto: nome,
        quantidadeAtual: Math.max(0, Number(body.quantidade_inicial || 0)),
        limiarStockBaixo: Number(body.limiar_stock_baixo || 5),
        icone: String(body.icone || "caixa"),
      },
    });
    return json(item, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
