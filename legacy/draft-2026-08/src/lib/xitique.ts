import { prisma } from "./db";

export async function marcarXitiqueAtrasado() {
  const agora = new Date();
  await prisma.xitiqueContribution.updateMany({
    where: {
      estado: "pendente",
      dataPrevista: { lt: agora },
      dataPago: null,
    },
    data: { estado: "atrasado" },
  });
}

export function gerarCalendario(
  periodicidade: string,
  semanas = 8,
): Date[] {
  const datas: Date[] = [];
  const passo = periodicidade === "mensal" ? 30 : periodicidade === "quinzenal" ? 14 : 7;
  const base = new Date();
  base.setHours(9, 0, 0, 0);
  for (let i = 0; i < semanas; i++) {
    const d = new Date(base);
    if (periodicidade === "mensal") d.setMonth(d.getMonth() + i);
    else d.setDate(d.getDate() + i * passo);
    datas.push(d);
  }
  return datas;
}

export function codigoConvite() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 3; i++) s += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return `UKU-${s}`;
}
