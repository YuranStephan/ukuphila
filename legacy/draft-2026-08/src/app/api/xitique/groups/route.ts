import { exigirUtilizador } from "@/lib/auth";
import { json, jsonErro } from "@/lib/http";
import { prisma } from "@/lib/db";
import { codigoConvite, gerarCalendario, marcarXitiqueAtrasado } from "@/lib/xitique";
import { DIAS_KYC_2 } from "@/lib/kyc";

export async function GET() {
  try {
    const user = await exigirUtilizador();
    await marcarXitiqueAtrasado();
    const memberships = await prisma.xitiqueMember.findMany({
      where: { userId: user.id },
      include: {
        group: {
          include: {
            members: true,
            contributions: true,
          },
        },
      },
    });
    return json(
      memberships.map((m) => {
        const g = m.group;
        const proxima = g.contributions
          .filter((c) => c.userId === user.id && (c.estado === "pendente" || c.estado === "atrasado"))
          .sort((a, b) => +new Date(a.dataPrevista) - +new Date(b.dataPrevista))[0];
        return {
          ...g,
          n_membros: g.members.length,
          proxima_data: proxima?.dataPrevista ?? null,
        };
      }),
    );
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const user = await exigirUtilizador();
    if (user.nivelKyc < 2) {
      return jsonErro(
        `Ainda faltam alguns dias de uso da caixa para abrires um xitique. Precisas de ${DIAS_KYC_2} dias.`,
      );
    }
    const body = await req.json();
    const nome = String(body.nome || "").trim();
    const valor = Math.round(Number(body.valor_contribuicao || 0));
    const periodicidade = String(body.periodicidade || "semanal");
    if (!nome || valor <= 0) return jsonErro("Diz o nome do grupo e o valor de cada contribuição.");

    const group = await prisma.xitiqueGroup.create({
      data: {
        nome,
        criadoPorUserId: user.id,
        valorContribuicao: valor,
        periodicidade,
        codigoConvite: codigoConvite(),
      },
    });
    await prisma.xitiqueMember.create({
      data: { groupId: group.id, userId: user.id, estado: "activo", nome: user.nome },
    });
    const datas = gerarCalendario(periodicidade);
    await prisma.xitiqueContribution.createMany({
      data: datas.map((d) => ({
        groupId: group.id,
        userId: user.id,
        valor,
        dataPrevista: d,
        estado: "pendente",
      })),
    });
    return json(group, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
