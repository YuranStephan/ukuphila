import { prisma } from "./db";

export const DIAS_KYC_2 = 14;

export async function actualizarKyc(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const hoje = new Date().toISOString().slice(0, 10);
  let dias = user.diasComTransacoes;
  if (user.ultimoDiaTransacao !== hoje) {
    dias += 1;
  }
  let nivel = user.nivelKyc;
  if (dias >= DIAS_KYC_2 && nivel < 2) nivel = 2;
  await prisma.user.update({
    where: { id: userId },
    data: {
      diasComTransacoes: dias,
      ultimoDiaTransacao: hoje,
      nivelKyc: nivel,
    },
  });
}

export function jornada(nivelKyc: number, dias: number) {
  return [
    { id: "registo", titulo: "Registo", feito: true },
    { id: "caixa", titulo: "Gestão de caixa", feito: dias >= 1 || nivelKyc >= 1 },
    { id: "poupanca", titulo: "Poupança", feito: dias >= 7 },
    { id: "xitique", titulo: "Xitique", feito: nivelKyc >= 2 },
    { id: "credito", titulo: "Crédito", feito: nivelKyc >= 3, futuro: true },
  ];
}
