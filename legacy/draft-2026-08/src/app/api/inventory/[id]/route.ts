import { exigirUtilizador } from "@/lib/auth";
import { json, jsonErro } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await exigirUtilizador();
    const { id } = await ctx.params;
    const body = await req.json();
    const item = await prisma.inventoryItem.findFirst({ where: { id, userId: user.id } });
    if (!item) return jsonErro("Não encontrámos este produto.", 404);
    const actualizado = await prisma.inventoryItem.update({
      where: { id },
      data: {
        quantidadeAtual: Number(body.quantidade_atual ?? item.quantidadeAtual),
        atualizadoEm: new Date(),
      },
    });
    return json(actualizado);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
