import { exigirUtilizador } from "@/lib/auth";
import { json, jsonErro } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await exigirUtilizador();
    const { id } = await ctx.params;
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) return jsonErro("Não encontrámos este agente.", 404);
    return json(agent);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
