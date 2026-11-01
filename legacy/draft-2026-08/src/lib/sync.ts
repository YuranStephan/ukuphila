import { prisma } from "./db";
import { actualizarKyc } from "./kyc";

export type AccaoSync = {
  tipo: string;
  payload: Record<string, unknown>;
  client_uuid: string;
  timestamp: string;
};

export async function aplicarTransacao(opts: {
  userId: string;
  pocketId: string;
  tipo: "venda" | "compra";
  valor: number;
  produtoId?: string | null;
  metodoRegisto?: string;
  clientUuid: string;
  criadoEm?: Date;
  quantidadeExtra?: number | null;
}) {
  const existente = await prisma.transaction.findUnique({
    where: { clientUuid: opts.clientUuid },
  });
  if (existente) return { transacao: existente, duplicado: true };

  const pocket = await prisma.pocket.findFirst({
    where: { id: opts.pocketId, userId: opts.userId },
  });
  if (!pocket) throw new Error("Bolso não encontrado.");

  const delta = opts.tipo === "venda" ? opts.valor : -opts.valor;
  const novoSaldo = pocket.saldoAtual + delta;
  const conflitoSaldo = novoSaldo < 0;

  const transacao = await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.create({
      data: {
        userId: opts.userId,
        pocketId: opts.pocketId,
        tipo: opts.tipo,
        valor: opts.valor,
        produtoId: opts.produtoId || null,
        metodoRegisto: opts.metodoRegisto || "texto",
        clientUuid: opts.clientUuid,
        criadoEm: opts.criadoEm ?? new Date(),
        sincronizadoEm: new Date(),
        precisaRevisao: conflitoSaldo,
        nota: conflitoSaldo
          ? "Este movimento deixou o bolso abaixo de zero — revê quando puderes."
          : null,
      },
    });
    await tx.pocket.update({
      where: { id: pocket.id },
      data: { saldoAtual: novoSaldo },
    });
    if (opts.produtoId) {
      const item = await tx.inventoryItem.findFirst({
        where: { id: opts.produtoId, userId: opts.userId },
      });
      if (item) {
        let q = item.quantidadeAtual;
        if (opts.tipo === "compra") {
          q += opts.quantidadeExtra && opts.quantidadeExtra > 0 ? opts.quantidadeExtra : 1;
        } else {
          q = Math.max(0, q - 1);
        }
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { quantidadeAtual: q, atualizadoEm: new Date() },
        });
      }
    }
    return t;
  });

  await actualizarKyc(opts.userId);
  if (conflitoSaldo) {
    await prisma.syncConflict.create({
      data: {
        userId: opts.userId,
        mensagem:
          "Dois movimentos no mesmo bolso deixaram o saldo a precisar de revisão. Nada foi apagado.",
        payload: JSON.stringify({ clientUuid: opts.clientUuid, pocketId: opts.pocketId }),
      },
    });
  }
  return { transacao, duplicado: false, conflitoSaldo };
}

export async function estadoCanonico(userId: string) {
  const [user, pockets, transactions, inventory, groups, conflicts] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { agente: true } }),
    prisma.pocket.findMany({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { criadoEm: "desc" },
      take: 80,
      include: { produto: true },
    }),
    prisma.inventoryItem.findMany({
      where: { userId },
      orderBy: { quantidadeAtual: "asc" },
    }),
    prisma.xitiqueMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            members: true,
            contributions: { orderBy: { dataPrevista: "asc" } },
          },
        },
      },
    }),
    prisma.syncConflict.findMany({ where: { userId, resolvido: false } }),
  ]);

  return {
    user,
    pockets,
    transactions,
    inventory,
    xitique: groups.map((m) => m.group),
    conflicts,
  };
}
