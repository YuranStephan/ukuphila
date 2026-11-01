import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysAgo(n: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 15, 0, 0);
  return d;
}

function futureDay(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d;
}

async function main() {
  await prisma.syncConflict.deleteMany();
  await prisma.syncAction.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.xitiqueContribution.deleteMany();
  await prisma.xitiqueMember.deleteMany();
  await prisma.xitiqueGroup.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.pocket.deleteMany();
  await prisma.otpChallenge.deleteMany();
  await prisma.user.deleteMany();
  await prisma.agent.deleteMany();

  const agente = await prisma.agent.create({
    data: {
      id: "agente-armando",
      nome: "Armando Cossa",
      quiosqueLocalizacao: "Quiosque Porta 12, Mercado Xipamanine",
      contacto: "82 441 9083",
    },
  });

  const celia = await prisma.user.create({
    data: {
      id: "user-celia",
      telefone: "841234567",
      nome: "Célia Nhampossa",
      fotoUrl: null,
      nivelKyc: 1,
      agenteId: agente.id,
      diasComTransacoes: 11,
      ultimoDiaTransacao: new Date().toISOString().slice(0, 10),
    },
  });

  const amelia = await prisma.user.create({
    data: {
      id: "user-amelia",
      telefone: "847778899",
      nome: "Amélia Sitoe",
      nivelKyc: 2,
      diasComTransacoes: 20,
    },
  });

  const fatima = await prisma.user.create({
    data: {
      id: "user-fatima",
      telefone: "846661122",
      nome: "Fátima Muchanga",
      nivelKyc: 2,
      diasComTransacoes: 18,
    },
  });

  const negocio = await prisma.pocket.create({
    data: { id: "pocket-celia-negocio", userId: celia.id, tipo: "negocio", saldoAtual: 8450 },
  });
  const casa = await prisma.pocket.create({
    data: { id: "pocket-celia-casa", userId: celia.id, tipo: "casa", saldoAtual: 2180 },
  });

  await prisma.pocket.createMany({
    data: [
      { userId: amelia.id, tipo: "negocio", saldoAtual: 3200 },
      { userId: amelia.id, tipo: "casa", saldoAtual: 900 },
      { userId: fatima.id, tipo: "negocio", saldoAtual: 5100 },
      { userId: fatima.id, tipo: "casa", saldoAtual: 1400 },
    ],
  });

  const tomate = await prisma.inventoryItem.create({
    data: {
      id: "inv-tomate",
      userId: celia.id,
      nomeProduto: "Tomate",
      quantidadeAtual: 3,
      limiarStockBaixo: 5,
      icone: "tomate",
    },
  });
  const capulana = await prisma.inventoryItem.create({
    data: {
      id: "inv-capulana",
      userId: celia.id,
      nomeProduto: "Capulana",
      quantidadeAtual: 12,
      limiarStockBaixo: 4,
      icone: "capulana",
    },
  });
  const peixe = await prisma.inventoryItem.create({
    data: {
      id: "inv-peixe",
      userId: celia.id,
      nomeProduto: "Peixe seco",
      quantidadeAtual: 7,
      limiarStockBaixo: 4,
      icone: "peixe",
    },
  });
  const carvao = await prisma.inventoryItem.create({
    data: {
      id: "inv-carvao",
      userId: celia.id,
      nomeProduto: "Carvão",
      quantidadeAtual: 4,
      limiarStockBaixo: 6,
      icone: "carvao",
    },
  });
  const cebola = await prisma.inventoryItem.create({
    data: {
      id: "inv-cebola",
      userId: celia.id,
      nomeProduto: "Cebola",
      quantidadeAtual: 18,
      limiarStockBaixo: 5,
      icone: "cebola",
    },
  });

  const txs = [
    { tipo: "venda", valor: 450, produtoId: tomate.id, pocketId: negocio.id, criadoEm: daysAgo(0, 7), clientUuid: "c-hoje-1", nota: "Tomate" },
    { tipo: "venda", valor: 750, produtoId: capulana.id, pocketId: negocio.id, criadoEm: daysAgo(0, 9), clientUuid: "c-hoje-2", nota: "Capulana" },
    { tipo: "compra", valor: 350, produtoId: cebola.id, pocketId: negocio.id, criadoEm: daysAgo(0, 11), clientUuid: "c-hoje-3", nota: "Cebola" },
    { tipo: "venda", valor: 280, produtoId: peixe.id, pocketId: negocio.id, criadoEm: daysAgo(0, 13), clientUuid: "c-hoje-4", nota: "Peixe seco" },
    { tipo: "compra", valor: 120, pocketId: casa.id, criadoEm: daysAgo(0, 18), clientUuid: "c-hoje-5", nota: "Pão e chá" },
    { tipo: "venda", valor: 600, produtoId: carvao.id, pocketId: negocio.id, criadoEm: daysAgo(1, 8), clientUuid: "c-d1-1", nota: "Carvão" },
    { tipo: "venda", valor: 320, produtoId: tomate.id, pocketId: negocio.id, criadoEm: daysAgo(1, 14), clientUuid: "c-d1-2", nota: "Tomate" },
    { tipo: "compra", valor: 500, produtoId: tomate.id, pocketId: negocio.id, criadoEm: daysAgo(2, 6), clientUuid: "c-d2-1", nota: "Tomate" },
    { tipo: "venda", valor: 900, produtoId: capulana.id, pocketId: negocio.id, criadoEm: daysAgo(3, 10), clientUuid: "c-d3-1", nota: "Capulana" },
    { tipo: "compra", valor: 200, pocketId: casa.id, criadoEm: daysAgo(4, 19), clientUuid: "c-d4-1", nota: "Sabão" },
    { tipo: "venda", valor: 180, produtoId: peixe.id, pocketId: negocio.id, criadoEm: daysAgo(5, 8), clientUuid: "c-d5-1", nota: "Peixe seco" },
  ];

  for (const t of txs) {
    await prisma.transaction.create({
      data: {
        userId: celia.id,
        metodoRegisto: "texto",
        sincronizadoEm: t.criadoEm,
        ...t,
      },
    });
  }

  const grupo = await prisma.xitiqueGroup.create({
    data: {
      id: "xitique-maes",
      nome: "Mães do Zimpeto",
      criadoPorUserId: amelia.id,
      valorContribuicao: 500,
      periodicidade: "semanal",
      codigoConvite: "ZIMP-441",
    },
  });

  const grupo2 = await prisma.xitiqueGroup.create({
    data: {
      id: "xitique-capulana",
      nome: "Irmãs da Capulana",
      criadoPorUserId: fatima.id,
      valorContribuicao: 200,
      periodicidade: "semanal",
      codigoConvite: "CAPU-208",
    },
  });

  await prisma.xitiqueMember.createMany({
    data: [
      { groupId: grupo.id, userId: celia.id, estado: "activo", nome: "Célia Nhampossa" },
      { groupId: grupo.id, userId: amelia.id, estado: "activo", nome: "Amélia Sitoe" },
      { groupId: grupo.id, userId: fatima.id, estado: "activo", nome: "Fátima Muchanga" },
      { groupId: grupo2.id, userId: fatima.id, estado: "activo", nome: "Fátima Muchanga" },
    ],
  });

  await prisma.xitiqueContribution.createMany({
    data: [
      { groupId: grupo.id, userId: celia.id, valor: 500, dataPrevista: daysAgo(7, 9), dataPago: daysAgo(7, 10), estado: "pago" },
      { groupId: grupo.id, userId: amelia.id, valor: 500, dataPrevista: daysAgo(7, 9), dataPago: daysAgo(7, 9), estado: "pago" },
      { groupId: grupo.id, userId: fatima.id, valor: 500, dataPrevista: daysAgo(7, 9), estado: "atrasado" },
      { groupId: grupo.id, userId: celia.id, valor: 500, dataPrevista: futureDay(0), estado: "pendente" },
      { groupId: grupo.id, userId: amelia.id, valor: 500, dataPrevista: futureDay(0), dataPago: daysAgo(0, 8), estado: "pago" },
      { groupId: grupo.id, userId: fatima.id, valor: 500, dataPrevista: futureDay(0), estado: "pendente" },
      { groupId: grupo.id, userId: celia.id, valor: 500, dataPrevista: futureDay(7), estado: "pendente" },
      { groupId: grupo.id, userId: amelia.id, valor: 500, dataPrevista: futureDay(7), estado: "pendente" },
      { groupId: grupo.id, userId: fatima.id, valor: 500, dataPrevista: futureDay(7), estado: "pendente" },
    ],
  });

  console.log("Semente pronta. Entra com 84 123 4567 — código de demonstração 246810");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
