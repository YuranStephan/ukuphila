/** Shared vocabulary. The KB asks for simple language, so these strings are product decisions, not decoration. */

export const POCKET_LABELS = { negocio: "Negócio", casa: "Casa", poupanca: "Poupança", xitique: "Xitique" } as const;

export const ENTRY_LABELS: Record<string, string> = {
  venda: "Venda",
  venda_fiado: "Venda a fiado",
  fiado_recebido: "Fiado recebido",
  despesa: "Despesa",
  compra_stock: "Compra de stock",
  ajuste_stock: "Ajuste de stock",
  transferencia: "Entre bolsos",
  entrada_capital: "Entrada de dinheiro",
  poupanca_deposito: "Poupança",
  poupanca_levantamento: "Levantamento da poupança",
  xitique_contribuicao: "Contribuição Xitique",
  xitique_recebimento: "Recebi o Xitique",
  credito_stock: "Stock a crédito",
  credito_pagamento: "Pagamento ao fornecedor",
  leasing_pagamento: "Prestação do telefone",
  estorno: "Correcção",
};

export const EXPENSE_CATEGORIES = [
  { key: "transporte", label: "Transporte" },
  { key: "taxa_mercado", label: "Taxa do mercado" },
  { key: "embalagem", label: "Sacos e embalagem" },
  { key: "credelec", label: "Credelec e água" },
  { key: "comunicacao", label: "Telefone e dados" },
  { key: "ajudante", label: "Ajudante" },
  { key: "outro", label: "Outra coisa" },
] as const;

export const KYC_LEVEL_LABELS: Record<number, string> = {
  0: "Por verificar",
  1: "Nível 1 · Inicial",
  2: "Nível 2 · Intermédio",
  3: "Nível 3 · Avançado",
};

/** Proposed list. KB §10 forbids assuming it is mandatory until the KYC policy is approved. */
export const DOCUMENT_TYPES: Record<string, string> = {
  bi: "Bilhete de Identidade",
  passaporte: "Passaporte",
  dire: "DIRE",
  cartao_eleitor: "Cartão de eleitor",
  declaracao_bairro: "Declaração do bairro",
  licenca_mercado: "Licença ou recibo do mercado",
  nuit: "NUIT",
  comprovativo_morada: "Comprovativo de morada",
};

export const REJECTION_REASONS: Record<string, string> = {
  ilegivel: "A fotografia não se lê bem",
  incompleto: "Falta parte do documento",
  expirado: "O documento está fora de validade",
  nao_corresponde: "Os dados não correspondem ao perfil",
  suspeita: "Precisa de verificação adicional",
  outro: "Outro motivo",
};

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  submetido: "Submetido",
  em_revisao: "Em revisão",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  expirado: "Expirado",
};

export const CONTRIBUTION_LABELS: Record<string, string> = {
  pendente: "Por pagar",
  declarada: "Por confirmar",
  confirmada: "Confirmada",
  atrasada: "Em atraso",
};

export const CONTRACT_LABELS: Record<string, string> = {
  aguarda_entrega: "Aguarda entrega",
  activo: "A pagar",
  em_atraso: "Em atraso",
  incumprimento: "Incumprimento",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
};

export const APPLICATION_LABELS: Record<string, string> = {
  submetido: "Submetido",
  em_analise: "Em análise",
  recomendado: "Recomendado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  aceite: "Aceite",
  desistido: "Desistiu",
  expirado: "Expirado",
};

export const CREDIT_REASON_CODES: Record<string, string> = {
  historial_curto: "Historial ainda curto",
  regularidade: "Registo pouco regular",
  poupanca: "Hábito de poupança por construir",
  verificacao: "Verificação incompleta",
  atraso: "Atrasos em curso",
  concentracao: "Limite de concentração atingido",
  valor: "Valor acima do limite da fase",
  historial_forte: "Historial sólido",
  xitique_pontual: "Pontualidade no Xitique",
  agente_confirma: "Agente confirma a actividade",
};

export const INCIDENT_KIND_LABELS: Record<string, string> = {
  suporte: "Suporte",
  tecnico: "Técnico",
  fraude: "Fraude",
  documento: "Documento",
  dispositivo: "Dispositivo",
  sync: "Sincronização",
  reclamacao: "Reclamação",
};

export const CONFLICT_LABELS: Record<string, string> = {
  stock_negativo: "Stock abaixo de zero",
  saldo_negativo: "Bolso abaixo de zero",
  fiado_excesso: "Pagamento acima da dívida",
  cadeia_quebrada: "Sequência offline quebrada",
  registo_antigo: "Registo antigo",
  limite_offline: "Acima do limite offline",
};

export const CONSENT_PURPOSES: Record<string, { label: string; detail: string; required: boolean }> = {
  servico_base: { label: "Usar o Ukuphila", detail: "Guardar os teus registos para te mostrar o teu negócio.", required: true },
  verificacao: { label: "Verificar a tua identidade", detail: "O teu agente e a equipa de revisão podem ver os documentos que submeteres.", required: true },
  voz_ia: { label: "Falar com o assistente", detail: "O que disseres ou escreveres é usado para propor registos e responder às tuas perguntas.", required: false },
  historial_credito: { label: "Usar o historial para crédito", detail: "A análise de crédito pode ver os teus sinais de confiança quando pedires crédito.", required: false },
  estudos: { label: "Melhorar o serviço", detail: "Os teus dados podem entrar em números agregados, sem o teu nome.", required: false },
};

export const PASSPORT_SECTIONS: Record<string, { label: string; detail: string }> = {
  identidade: { label: "Nome e mercado", detail: "O nome pelo qual te conhecem, o mercado e a actividade." },
  verificacao: { label: "Nível de verificação", detail: "Só o nível. Nunca os documentos." },
  actividade: { label: "Regularidade", detail: "Meses de historial e dias com registo." },
  volume: { label: "Volume de vendas", detail: "Em faixas, nunca o valor exacto." },
  poupanca: { label: "Hábito de poupança", detail: "Meses com poupança, nunca o saldo." },
  xitique: { label: "Pontualidade no Xitique", detail: "Contribuições pagas a tempo." },
  credito: { label: "Pagamentos a fornecedores", detail: "Prestações pagas a tempo." },
};
