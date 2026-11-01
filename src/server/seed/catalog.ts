/*
 * Synthetic demonstration data. Names are invented, combinations of common first names and surnames from southern
 * Mozambique, and do not describe real people. Suppliers are fictional businesses.
 */

export const FIRST_NAMES = [
  "Celeste", "Armando", "Rosa", "Lurdes", "Teresa", "Ernesto", "Amélia", "Júlia", "Fátima", "Alberto", "Graça", "Helena", "Inácio", "Joana", "Lina",
  "Marta", "Nelson", "Olinda", "Paulina", "Raquel", "Sónia", "Tomás", "Verónica", "Zita", "Beatriz", "Carlota", "Domingos", "Esperança", "Filomena", "Gertrudes",
  "Hortência", "Isabel", "Jacinta", "Leonor", "Matilde", "Natália", "Ofélia", "Palmira", "Quitéria", "Rute", "Salomé", "Tânia", "Ursula", "Vitória", "Xavier",
  "Adelino", "Benigna", "Custódio", "Delfina", "Eugénio",
];

export const SURNAMES = [
  "Machava", "Cossa", "Nhantumbo", "Sitoe", "Bila", "Macuácua", "Tembe", "Mabunda", "Manhiça", "Langa", "Massingue", "Nhaca", "Zandamela", "Chauque", "Matsinhe",
  "Muchanga", "Ubisse", "Novela", "Mucavele", "Guambe",
];

export type Trade = {
  activity: string;
  category: string;
  business: (firstName: string) => string;
  dailyRevenue: [number, number];
  products: { name: string; unit: string; icon: string; cost: number; price: number; pulse?: string }[];
};

export const TRADES: Trade[] = [
  {
    activity: "Hortícolas",
    category: "Alimentos frescos",
    business: (name) => `Banca da ${name}`,
    dailyRevenue: [1800, 4200],
    products: [
      { name: "Tomate", unit: "caixa", icon: "tomate", cost: 720, price: 1000, pulse: "Tomate, caixa" },
      { name: "Cebola", unit: "saco", icon: "cebola", cost: 900, price: 1250, pulse: "Cebola, saco" },
      { name: "Batata", unit: "saco", icon: "batata", cost: 840, price: 1150, pulse: "Batata, saco" },
      { name: "Couve", unit: "molho", icon: "folhas", cost: 18, price: 30 },
      { name: "Alface", unit: "unidade", icon: "folhas", cost: 25, price: 40 },
    ],
  },
  {
    activity: "Peixe seco e carapau",
    category: "Alimentos",
    business: (name) => `Peixaria ${name}`,
    dailyRevenue: [2200, 5200],
    products: [
      { name: "Carapau", unit: "caixa", icon: "peixe", cost: 1650, price: 2100, pulse: "Carapau, caixa" },
      { name: "Magumba seca", unit: "balde", icon: "peixe", cost: 480, price: 720 },
      { name: "Camarão seco", unit: "copo", icon: "peixe", cost: 60, price: 100 },
    ],
  },
  {
    activity: "Mercearia",
    category: "Bens de consumo",
    business: (name) => `Mercearia ${name}`,
    dailyRevenue: [2600, 6800],
    products: [
      { name: "Arroz 25 kg", unit: "saco", icon: "saco", cost: 1320, price: 1550, pulse: "Arroz, 25 kg" },
      { name: "Óleo 5 L", unit: "garrafa", icon: "garrafa", cost: 690, price: 820, pulse: "Óleo, 5 L" },
      { name: "Açúcar 1 kg", unit: "pacote", icon: "saco", cost: 74, price: 95, pulse: "Açúcar, 1 kg" },
      { name: "Farinha 5 kg", unit: "saco", icon: "saco", cost: 245, price: 310 },
      { name: "Sabão", unit: "barra", icon: "caixa", cost: 38, price: 55 },
    ],
  },
  {
    activity: "Capulanas e roupa",
    category: "Vestuário",
    business: (name) => `Capulanas ${name}`,
    dailyRevenue: [1400, 4600],
    products: [
      { name: "Capulana", unit: "peça", icon: "tecido", cost: 260, price: 420, pulse: "Capulana, peça" },
      { name: "Lenço", unit: "peça", icon: "tecido", cost: 65, price: 120 },
      { name: "Camisa", unit: "peça", icon: "tecido", cost: 210, price: 380 },
    ],
  },
  {
    activity: "Fruta",
    category: "Alimentos frescos",
    business: (name) => `Frutas ${name}`,
    dailyRevenue: [1200, 3400],
    products: [
      { name: "Banana", unit: "cacho", icon: "fruta", cost: 110, price: 180, pulse: "Banana, cacho" },
      { name: "Laranja", unit: "balde", icon: "fruta", cost: 140, price: 220 },
      { name: "Manga", unit: "balde", icon: "fruta", cost: 120, price: 200 },
      { name: "Abacate", unit: "balde", icon: "fruta", cost: 170, price: 260 },
    ],
  },
];

export const SUPPLIERS = [
  {
    name: "Frescos da Matola",
    category: "Hortícolas por grosso",
    phone: "+258841000101",
    products: [
      { name: "Tomate", unit: "caixa", price: 700 },
      { name: "Cebola", unit: "saco", price: 880 },
      { name: "Batata", unit: "saco", price: 820 },
    ],
  },
  {
    name: "Grossista Baixa Comercial",
    category: "Mercearia por grosso",
    phone: "+258841000102",
    products: [
      { name: "Arroz 25 kg", unit: "saco", price: 1290 },
      { name: "Óleo 5 L", unit: "garrafa", price: 670 },
      { name: "Açúcar 1 kg", unit: "pacote", price: 72 },
      { name: "Farinha 5 kg", unit: "saco", price: 240 },
    ],
  },
  {
    name: "Tecidos do Índico",
    category: "Capulanas e tecidos",
    phone: "+258841000103",
    products: [
      { name: "Capulana", unit: "peça", price: 250 },
      { name: "Lenço", unit: "peça", price: 60 },
    ],
  },
];

export const STAFF = [
  { email: "gestao@ukuphila.demo", name: "Equipa de Gestão", role: "admin", password: "Ukuphila-gestao-2026" },
  { email: "revisao@ukuphila.demo", name: "Revisão KYC", role: "kyc_reviewer", password: "Ukuphila-revisao-2026" },
  { email: "analise@ukuphila.demo", name: "Análise de Crédito", role: "credit_analyst", password: "Ukuphila-analise-2026" },
  { email: "aprovacao@ukuphila.demo", name: "Aprovação de Crédito", role: "credit_approver", password: "Ukuphila-aprovacao-2026" },
  { email: "risco@ukuphila.demo", name: "Sala de Risco", role: "risk_analyst", password: "Ukuphila-risco-2026" },
  { email: "auditoria@ukuphila.demo", name: "Auditoria", role: "auditor", password: "Ukuphila-auditoria-2026" },
] as const;

export const AGENTS = [
  { name: "Nélia Sitoe", phone: "+258840000001", market: "xipamanine", code: "AG-XIP-01", kiosk: "Quiosque da entrada principal", hours: "Seg a Sáb, 7h às 16h" },
  { name: "Bento Tembe", phone: "+258840000002", market: "zimpeto", code: "AG-ZIM-01", kiosk: "Quiosque junto ao terminal", hours: "Seg a Sáb, 7h às 16h" },
  { name: "Amina Ubisse", phone: "+258840000003", market: "fajardo", code: "AG-FAJ-01", kiosk: "Quiosque da rua lateral", hours: "Seg a Sex, 7h às 15h" },
] as const;

/** Fixed phones so the pitch can jump straight to these people. */
export const PERSONA_PHONES = { celeste: "+258841111001", armando: "+258841111002", rosa: "+258841111003" } as const;
