/*
 * Readiness is explained, never scored in the dark (KB §16). This file is pure so it can run in tests, in the fairness
 * check and in the merchant's own screen, and it deliberately has no input for age, sex, religion, language, or how
 * often someone opens the app: product usage is not financial merit.
 *
 * The output is evidence for a human. Nothing here approves credit.
 */

export type TrustPolicy = {
  version: string;
  isExample: boolean;
  ring2: { activeDays14: number };
  ring3: { activeDays30: number; minKycLevel: number };
  ring4: { minMonths: number; activeDays90: number; minKycLevel: number; minSavingsMonths: number; minXitiquePunctuality: number };
};

export type TrustFacts = {
  monthsActive: number;
  activeDays14: number;
  activeDays30: number;
  activeDays90: number;
  transfersToCasa60: number;
  salesWeeksCv: number | null;
  kycLevel: number;
  savingsMonths6: number;
  savingsBalanceCents: number;
  xitiqueDue: number;
  xitiqueOnTime: number;
  creditInstalmentsDue: number;
  creditInstalmentsOnTime: number;
  creditOverdue: number;
  supplierContractsSettled: number;
};

export type SignalState = "forte" | "a_crescer" | "fraco" | "sem_dados";

export type Signal = {
  key: string;
  family: "Actividade" | "Caixa" | "Poupança" | "Xitique" | "Crédito" | "Fornecedor" | "Verificação";
  label: string;
  evidence: string;
  state: SignalState;
};

export type Readiness = "a_comecar" | "a_crescer" | "quase" | "pronto_para_revisao";

export type RingStep = { ring: 1 | 2 | 3 | 4; name: string; done: boolean; missing: string[] };

export type TrustResult = {
  policyVersion: string;
  isExamplePolicy: boolean;
  ring: 1 | 2 | 3 | 4;
  readiness: Readiness;
  signals: Signal[];
  rings: RingStep[];
  blockers: string[];
};

const days = (value: number) => `${value} ${value === 1 ? "dia" : "dias"}`;

export function buildSignals(facts: TrustFacts): Signal[] {
  const signals: Signal[] = [];
  signals.push({
    key: "regularidade",
    family: "Actividade",
    label: "Regularidade do registo",
    evidence: `Registaste em ${days(facts.activeDays30)} dos últimos 30.`,
    state: facts.activeDays30 >= 20 ? "forte" : facts.activeDays30 >= 8 ? "a_crescer" : facts.activeDays30 > 0 ? "fraco" : "sem_dados",
  });
  signals.push({
    key: "antiguidade",
    family: "Actividade",
    label: "Tempo de historial",
    evidence: facts.monthsActive >= 1 ? `Tens ${facts.monthsActive} ${facts.monthsActive === 1 ? "mês" : "meses"} de registos.` : "Ainda não completaste um mês de registos.",
    state: facts.monthsActive >= 6 ? "forte" : facts.monthsActive >= 2 ? "a_crescer" : facts.monthsActive >= 1 ? "fraco" : "sem_dados",
  });
  signals.push({
    key: "separacao",
    family: "Caixa",
    label: "Separação negócio e casa",
    evidence: facts.transfersToCasa60 > 0 ? `Separaste dinheiro para casa ${facts.transfersToCasa60} vezes em 60 dias.` : "Ainda não separaste dinheiro para casa.",
    state: facts.transfersToCasa60 >= 6 ? "forte" : facts.transfersToCasa60 >= 2 ? "a_crescer" : facts.transfersToCasa60 === 1 ? "fraco" : "sem_dados",
  });
  signals.push({
    key: "estabilidade",
    family: "Caixa",
    label: "Estabilidade das vendas",
    evidence:
      facts.salesWeeksCv === null
        ? "Precisamos de mais semanas de vendas para ver isto."
        : facts.salesWeeksCv <= 0.35
          ? "As tuas vendas semanais são estáveis."
          : facts.salesWeeksCv <= 0.7
            ? "As tuas vendas variam de semana para semana, o que é normal num mercado."
            : "As tuas vendas mudam muito de semana para semana.",
    state: facts.salesWeeksCv === null ? "sem_dados" : facts.salesWeeksCv <= 0.35 ? "forte" : facts.salesWeeksCv <= 0.7 ? "a_crescer" : "fraco",
  });
  signals.push({
    key: "poupanca",
    family: "Poupança",
    label: "Hábito de poupar",
    evidence: facts.savingsMonths6 > 0 ? `Guardaste dinheiro em ${facts.savingsMonths6} dos últimos 6 meses.` : "Ainda não guardaste dinheiro na poupança.",
    state: facts.savingsMonths6 >= 4 ? "forte" : facts.savingsMonths6 >= 2 ? "a_crescer" : facts.savingsMonths6 === 1 ? "fraco" : "sem_dados",
  });
  const punctuality = facts.xitiqueDue > 0 ? facts.xitiqueOnTime / facts.xitiqueDue : null;
  signals.push({
    key: "xitique",
    family: "Xitique",
    label: "Pontualidade no Xitique",
    evidence: facts.xitiqueDue > 0 ? `Pagaste ${facts.xitiqueOnTime} de ${facts.xitiqueDue} contribuições a tempo.` : "Ainda não participas num Xitique registado.",
    state: punctuality === null ? "sem_dados" : punctuality >= 0.9 ? "forte" : punctuality >= 0.7 ? "a_crescer" : "fraco",
  });
  if (facts.creditInstalmentsDue > 0 || facts.creditOverdue > 0) {
    const onTime = facts.creditInstalmentsDue > 0 ? facts.creditInstalmentsOnTime / facts.creditInstalmentsDue : 0;
    signals.push({
      key: "credito",
      family: "Crédito",
      label: "Pagamentos ao fornecedor",
      evidence: facts.creditOverdue > 0 ? `Tens ${facts.creditOverdue} ${facts.creditOverdue === 1 ? "prestação" : "prestações"} em atraso.` : `Pagaste ${facts.creditInstalmentsOnTime} de ${facts.creditInstalmentsDue} prestações a tempo.`,
      state: facts.creditOverdue > 0 ? "fraco" : onTime >= 0.9 ? "forte" : "a_crescer",
    });
  }
  if (facts.supplierContractsSettled > 0) {
    signals.push({
      key: "fornecedor",
      family: "Fornecedor",
      label: "Compras liquidadas",
      evidence: `Liquidaste ${facts.supplierContractsSettled} ${facts.supplierContractsSettled === 1 ? "compra" : "compras"} a fornecedores.`,
      state: "forte",
    });
  }
  signals.push({
    key: "verificacao",
    family: "Verificação",
    label: "Verificação de identidade",
    evidence: facts.kycLevel >= 2 ? `Nível ${facts.kycLevel} de verificação.` : facts.kycLevel === 1 ? "Nível 1. Um documento aprovado leva-te ao nível 2." : "Falta a verificação inicial com o teu agente.",
    state: facts.kycLevel >= 2 ? "forte" : facts.kycLevel === 1 ? "a_crescer" : "sem_dados",
  });
  return signals;
}

export function evaluateTrust(facts: TrustFacts, policy: TrustPolicy): TrustResult {
  const second: string[] = [];
  if (facts.activeDays14 < policy.ring2.activeDays14) second.push(`Regista em ${days(policy.ring2.activeDays14 - facts.activeDays14)} mais nas próximas duas semanas.`);

  const third: string[] = [];
  if (facts.activeDays30 < policy.ring3.activeDays30) third.push(`Regista em ${days(policy.ring3.activeDays30 - facts.activeDays30)} mais neste mês.`);
  if (facts.kycLevel < policy.ring3.minKycLevel) third.push("Faz a verificação inicial com o teu agente.");

  const fourth: string[] = [];
  const r = policy.ring4;
  if (facts.monthsActive < r.minMonths) fourth.push(`Continua a registar por mais ${r.minMonths - facts.monthsActive} ${r.minMonths - facts.monthsActive === 1 ? "mês" : "meses"}.`);
  if (facts.activeDays90 < r.activeDays90) fourth.push(`Faltam ${days(r.activeDays90 - facts.activeDays90)} com registo nos últimos 3 meses.`);
  if (facts.kycLevel < r.minKycLevel) fourth.push(`Chega ao nível ${r.minKycLevel} de verificação com um documento aprovado.`);
  if (facts.savingsMonths6 < r.minSavingsMonths) fourth.push(`Guarda dinheiro em ${r.minSavingsMonths - facts.savingsMonths6} ${r.minSavingsMonths - facts.savingsMonths6 === 1 ? "mês" : "meses"} mais.`);
  const punctuality = facts.xitiqueDue > 0 ? facts.xitiqueOnTime / facts.xitiqueDue : null;
  if (punctuality !== null && punctuality < r.minXitiquePunctuality) fourth.push("Põe as contribuições do Xitique em dia.");

  const blockers = facts.creditOverdue > 0 ? ["Tens prestações em atraso. Fala com o teu agente."] : [];

  const rings: RingStep[] = [
    { ring: 1, name: "Caixa", done: facts.activeDays30 > 0 || facts.monthsActive > 0, missing: facts.activeDays30 > 0 || facts.monthsActive > 0 ? [] : ["Regista a tua primeira venda."] },
    { ring: 2, name: "Poupança", done: second.length === 0, missing: second },
    { ring: 3, name: "Xitique", done: third.length === 0, missing: third },
    { ring: 4, name: "Crédito", done: fourth.length === 0 && blockers.length === 0, missing: [...fourth, ...blockers] },
  ];

  // Rings are cumulative: a later ring only counts when the earlier ones hold.
  let ring: 1 | 2 | 3 | 4 = 1;
  if (rings[1].done) ring = 2;
  if (rings[1].done && rings[2].done) ring = 3;
  if (rings[1].done && rings[2].done && rings[3].done) ring = 4;

  const readiness: Readiness = ring === 4 ? "pronto_para_revisao" : fourth.length + blockers.length <= 1 && ring === 3 ? "quase" : facts.activeDays30 >= policy.ring3.activeDays30 / 2 ? "a_crescer" : "a_comecar";

  return { policyVersion: policy.version, isExamplePolicy: policy.isExample, ring, readiness, signals: buildSignals(facts), rings, blockers };
}

export const READINESS_LABELS: Record<Readiness, string> = {
  a_comecar: "A começar",
  a_crescer: "A crescer",
  quase: "Quase lá",
  pronto_para_revisao: "Pronto para revisão",
};
