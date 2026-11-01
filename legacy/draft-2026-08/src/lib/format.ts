export function formatarMT(valor: number) {
  const n = Math.round(valor);
  const sinal = n < 0 ? "-" : "";
  const abs = Math.abs(n).toString();
  const comPontos = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sinal}${comPontos} MT`;
}

export function saudacaoHora(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || nome;
}

export function periodoRange(periodo?: string | null) {
  const now = new Date();
  const start = new Date(now);
  if (periodo === "semana") {
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
  } else if (periodo === "mes") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setHours(0, 0, 0, 0);
  }
  return { start, end: now };
}
