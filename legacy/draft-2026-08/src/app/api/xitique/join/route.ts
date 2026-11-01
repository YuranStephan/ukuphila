import { prisma } from "@/lib/db";
import { json, jsonErro } from "@/lib/http";
import { exigirUtilizador } from "@/lib/auth";
import { gerarCalendario } from "@/lib/xitique";

export async function POST(req: Request) {
  try {
    const user = await exigirUtilizador();
    const body = await req.json();
    const codigo = String(body.codigo || "").trim().toUpperCase();
    if (!codigo) return jsonErro("Escreve o código do grupo.");
    const group = await prisma.xitiqueGroup.findFirst({
      where: { codigoConvite: codigo },
    });
    if (!group) return jsonErro("Este código não abre nenhum grupo.");
    const ja = await prisma.xitiqueMember.findFirst({
      where: { groupId: group.id, userId: user.id },
    });
    if (ja) return json({ ok: true, group });
    await prisma.xitiqueMember.create({
      data: { groupId: group.id, userId: user.id, estado: "activo", nome: user.nome },
    });
    const datas = gerarCalendario(group.periodicidade);
    await prisma.xitiqueContribution.createMany({
      data: datas.map((d) => ({
        groupId: group.id,
        userId: user.id,
        valor: group.valorContribuicao,
        dataPrevista: d,
        estado: "pendente",
      })),
    });
    return json({ ok: true, group });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
