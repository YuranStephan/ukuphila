import { exigirUtilizador } from "@/lib/auth";
import { json, jsonErro } from "@/lib/http";
import { prisma } from "@/lib/db";
import { gerarCalendario, marcarXitiqueAtrasado } from "@/lib/xitique";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await exigirUtilizador();
    await marcarXitiqueAtrasado();
    const { id } = await ctx.params;
    const group = await prisma.xitiqueGroup.findUnique({
      where: { id },
      include: {
        members: true,
        contributions: { orderBy: { dataPrevista: "asc" } },
      },
    });
    if (!group) return jsonErro("Não encontrámos este grupo.", 404);
    const membro = group.members.some((m) => m.userId === user.id);
    if (!membro) return jsonErro("Este grupo não é teu.", 403);
    const total = group.contributions.filter((c) => c.estado === "pago").reduce((s, c) => s + c.valor, 0);
    return json({ ...group, total_acumulado: total });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await exigirUtilizador();
    const { id } = await ctx.params;
    const url = new URL(req.url);
    if (url.pathname.endsWith("/join")) {
      return joinGroup(user.id, user.nome, id, await req.json().catch(() => ({})));
    }
    if (url.pathname.endsWith("/contributions")) {
      const body = await req.json();
      const contrib = await prisma.xitiqueContribution.findFirst({
        where: { groupId: id, userId: user.id, estado: { in: ["pendente", "atrasado"] } },
        orderBy: { dataPrevista: "asc" },
      });
      if (!contrib) return jsonErro("Não há contribuição à espera.");
      const actualizado = await prisma.xitiqueContribution.update({
        where: { id: contrib.id },
        data: {
          estado: "pago",
          dataPago: body.data_pago ? new Date(body.data_pago) : new Date(),
          valor: Number(body.valor || contrib.valor),
        },
      });
      return json(actualizado);
    }
    return jsonErro("Pedido não reconhecido.");
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

async function joinGroup(userId: string, nome: string, idOrCode: string, body: { codigo?: string }) {
  const codigo = String(body.codigo || idOrCode);
  const group =
    (await prisma.xitiqueGroup.findUnique({ where: { id: idOrCode } })) ||
    (await prisma.xitiqueGroup.findUnique({ where: { codigoConvite: codigo } })) ||
    (await prisma.xitiqueGroup.findFirst({ where: { codigoConvite: { equals: codigo } } }));
  if (!group) return jsonErro("Este código não abre nenhum grupo.");
  const ja = await prisma.xitiqueMember.findFirst({ where: { groupId: group.id, userId } });
  if (ja) return json({ ok: true, group, ja_era_membro: true });
  await prisma.xitiqueMember.create({
    data: { groupId: group.id, userId, estado: "activo", nome },
  });
  const datas = gerarCalendario(group.periodicidade);
  await prisma.xitiqueContribution.createMany({
    data: datas.map((d) => ({
      groupId: group.id,
      userId,
      valor: group.valorContribuicao,
      dataPrevista: d,
      estado: "pendente",
    })),
  });
  return json({ ok: true, group });
}
