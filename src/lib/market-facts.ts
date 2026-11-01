/*
 * Public figures shown on the site and in the pitch. Each one was read from the cited source on 2026-11-01.
 * A number that cannot be traced to a source does not belong here (see docs/PITCH.md for what is still unverified).
 */

export const SOURCES = {
  bm2025: {
    label: "Banco de Moçambique, Relatório de Inclusão Financeira 2025",
    url: "https://www.bancomoc.mz/media/wn0jhtef/financial-inclusion-report-2025.pdf",
  },
  rtp: {
    label: "RTP, com dados do Banco de Moçambique",
    url: "https://www.rtp.pt/noticias/economia/carteiras-moveis-com-246-milhoes-de-contas-em-mocambique-para-66-milhoes-no-banco_n1716174",
  },
} as const;

export const FACTS = {
  walletAccounts: { value: "1 313", unit: "contas móveis por 1 000 adultos", period: "2025", source: SOURCES.bm2025 },
  bankAccounts: { value: "337", unit: "contas bancárias por 1 000 adultos", period: "2025", source: SOURCES.bm2025 },
  creditGdp: { value: "19%", unit: "do PIB em crédito à economia", period: "2025", source: SOURCES.bm2025 },
  depositsGdp: { value: "51%", unit: "do PIB em depósitos", period: "2025", source: SOURCES.bm2025 },
  accessPoints: { value: "482 359", unit: "pontos de acesso financeiro", period: "2025", source: SOURCES.bm2025 },
  womenCredit: { value: "34%", unit: "é a quota das mulheres no crédito", period: "2025", source: SOURCES.bm2025 },
  microOperators: { value: "3 426", unit: "operadores de microcrédito", period: "2025", source: SOURCES.bm2025 },
} as const;

export const SANDBOX_NOTE =
  "A 6.ª edição do Sandbox Regulatório do Banco de Moçambique, lançada em Março de 2025, juntou 11 fintechs, incluindo soluções de poupança e crédito digitais e modelos alternativos de avaliação de crédito.";

export const MICROCREDIT_NOTE =
  "Os operadores de microcrédito têm de se registar no Banco de Moçambique (artigo 157 do Decreto n.º 50/2024, de 11 de Julho).";
