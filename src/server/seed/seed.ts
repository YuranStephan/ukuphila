import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { GENESIS_HASH } from "@/lib/canonical";
import { addDays, dayStart, maputoDay, daysBetween } from "@/lib/dates";
import { recordAudit } from "../audit";
import { encryptBytes, hashSecret, randomCode, sha256 } from "../crypto";
import type { Db, Tx } from "../db/client";
import * as t from "../db/schema";
import type { AccountCode, CreditPolicyParams, EntryKind } from "../db/schema";
import { isDemo } from "../env";
import { ensureAccounts } from "../ledger/accounts";
import { computeEntryHash, type EntryLine } from "../ledger/post";
import { getSetting } from "../settings";
import { evaluateTrust } from "../trust/engine";
import { gatherFacts } from "../trust/facts";
import { drawOrder } from "../xitique/service";
import { AGENTS, FIRST_NAMES, PERSONA_PHONES, STAFF, SUPPLIERS, SURNAMES, TRADES, type Trade } from "./catalog";
import { seedCore } from "./core";

const SYSTEM_EMAIL = "sistema@ukuphila.demo";

function prng(seed: number) {
  let state = seed;
  const next = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (low: number, high: number) => low + next() * (high - low),
    int: (low: number, high: number) => Math.floor(low + next() * (high - low + 1)),
    pick: <T>(list: readonly T[]) => list[Math.floor(next() * list.length)],
    chance: (probability: number) => next() < probability,
  };
}

type Random = ReturnType<typeof prng>;

/** Builds a person's books in memory with the same hashing as postEntry, then writes them in bulk. */
class Book {
  seq = 0;
  prevHash = GENESIS_HASH;
  entries: (typeof t.journalEntries.$inferInsert)[] = [];
  postings: (typeof t.postings.$inferInsert)[] = [];
  balances = new Map<string, number>();

  constructor(
    readonly userId: string,
    readonly accounts: Map<string, string>,
  ) {}

  post(input: {
    id?: string;
    kind: EntryKind;
    at: Date;
    amountCents: number;
    lines: EntryLine[];
    channel?: t.Channel;
    recordedBy?: string;
    category?: string | null;
    memo?: string | null;
    productId?: string | null;
    quantity?: number | null;
    customerId?: string | null;
    goalId?: string | null;
    refType?: string | null;
    refId?: string | null;
    needsReview?: boolean;
    reviewNote?: string | null;
  }) {
    const id = input.id ?? randomUUID();
    this.seq += 1;
    const opId = randomUUID();
    const hash = computeEntryHash({ prevHash: this.prevHash, seq: this.seq, userId: this.userId, kind: input.kind, occurredAt: input.at, amountCents: input.amountCents, opId, reversesId: null, lines: input.lines });
    this.entries.push({
      id,
      userId: this.userId,
      seq: this.seq,
      kind: input.kind,
      occurredAt: input.at,
      recordedAt: input.at,
      channel: input.channel ?? "app",
      recordedBy: input.recordedBy ?? this.userId,
      opId,
      amountCents: input.amountCents,
      category: input.category ?? null,
      memo: input.memo ?? null,
      productId: input.productId ?? null,
      quantity: input.quantity ?? null,
      customerId: input.customerId ?? null,
      goalId: input.goalId ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      needsReview: input.needsReview ?? false,
      reviewNote: input.reviewNote ?? null,
      prevHash: this.prevHash,
      hash,
    });
    this.prevHash = hash;
    for (const line of input.lines) {
      this.postings.push({ entryId: id, accountId: this.accounts.get(line.account) as string, amountCents: line.amountCents });
      this.balances.set(line.account, (this.balances.get(line.account) ?? 0) + line.amountCents);
    }
    return id;
  }

  balance(code: AccountCode) {
    return this.balances.get(code) ?? 0;
  }
}

type Profile = "exemplar" | "constante" | "irregular" | "novo" | "parado";

const PROFILE = {
  exemplar: { days: [200, 280], activity: 0.93, saveEvery: 9, homeEvery: 3 },
  constante: { days: [110, 210], activity: 0.8, saveEvery: 14, homeEvery: 4 },
  irregular: { days: [60, 150], activity: 0.45, saveEvery: 40, homeEvery: 9 },
  novo: { days: [6, 28], activity: 0.75, saveEvery: 99, homeEvery: 8 },
  parado: { days: [70, 120], activity: 0.55, saveEvery: 60, homeEvery: 12 },
} as const;

type Person = {
  id: string;
  name: string;
  phone: string;
  marketId: string;
  marketSlug: string;
  agentId: string;
  agentUserId: string;
  trade: Trade;
  profile: Profile;
  book: Book;
  products: { id: string; name: string; unit: string; icon: string; pulse?: string; salePriceCents: number; avgCostCents: number; quantity: number; cost: number; price: number }[];
  customers: { id: string; name: string; owed: number }[];
  goalId: string | null;
  startDay: string;
};

/** Daily life of one stall: sales, restocking, small costs, money for home, and some saving. */
function simulate(person: Person, today: string, random: Random) {
  const { book, products, customers, trade, profile } = person;
  const behaviour = PROFILE[profile];
  const lastDay = profile === "parado" ? addDays(today, -random.int(16, 30)) : today;
  book.post({ kind: "entrada_capital", at: atTime(person.startDay, 7, random), amountCents: random.int(8, 20) * 100_000, lines: lines("negocio", "capital", 0), memo: "Dinheiro com que comecei" });
  const opening = book.entries[book.entries.length - 1].amountCents as number;
  book.balances.set("negocio", 0);
  book.balances.set("capital", 0);
  book.postings.splice(-2);
  book.postings.push({ entryId: book.entries[book.entries.length - 1].id as string, accountId: book.accounts.get("negocio") as string, amountCents: opening });
  book.postings.push({ entryId: book.entries[book.entries.length - 1].id as string, accountId: book.accounts.get("capital") as string, amountCents: -opening });
  book.balances.set("negocio", opening);
  book.balances.set("capital", -opening);

  for (const product of products) {
    product.quantity = random.int(12, 30);
    product.avgCostCents = product.cost * 100;
  }

  const span = daysBetween(person.startDay, lastDay);
  for (let offset = 0; offset <= span; offset += 1) {
    const day = addDays(person.startDay, offset);
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const isSunday = weekday === 0;
    const weekend = weekday === 6 ? 1.3 : weekday === 5 ? 1.12 : 1;
    if (!random.chance(isSunday ? behaviour.activity * 0.25 : behaviour.activity)) continue;

    const target = random.range(trade.dailyRevenue[0], trade.dailyRevenue[1]) * weekend * 100;
    let sold = 0;
    let guard = 0;
    while (sold < target && guard < 5) {
      guard += 1;
      const product = random.pick(products);
      const quantity = Math.max(1, Math.round(random.range(1, Math.max(1.4, target / product.salePriceCents / 1.6))));
      const amount = quantity * product.salePriceCents;
      const onCredit = customers.length > 0 && random.chance(0.06);
      const customer = onCredit ? random.pick(customers) : null;
      const at = atTime(day, random.int(7, 15), random);
      const cost = product.avgCostCents * quantity;
      const entryLines: EntryLine[] = [
        { account: customer ? "fiado" : "negocio", amountCents: amount },
        { account: "receita", amountCents: -amount },
        { account: "custo_vendas", amountCents: cost },
        { account: "stock", amountCents: -cost },
      ];
      const channel: t.Channel = random.chance(0.26) ? "voz" : random.chance(0.14) ? "whatsapp" : "app";
      book.post({ kind: customer ? "venda_fiado" : "venda", at, amountCents: amount, lines: entryLines, channel, productId: product.id, quantity, customerId: customer?.id, category: "custo_conhecido" });
      if (customer) customer.owed += amount;
      product.quantity = Math.max(0, product.quantity - quantity);
      sold += amount;
    }

    for (const customer of customers) {
      if (customer.owed > 0 && random.chance(0.07)) {
        const paid = Math.min(customer.owed, random.int(2, 8) * 10_000);
        book.post({ kind: "fiado_recebido", at: atTime(day, 14, random), amountCents: paid, lines: lines("negocio", "fiado", paid), customerId: customer.id });
        customer.owed -= paid;
      }
    }

    if (random.chance(0.55)) {
      const category = random.pick(["transporte", "transporte", "taxa_mercado", "embalagem", "comunicacao", "credelec"]);
      const amount = random.int(3, 18) * 1000;
      book.post({ kind: "despesa", at: atTime(day, 12, random), amountCents: amount, lines: lines("despesas", "negocio", amount), category });
    }

    for (const product of products) {
      if (product.quantity > 6) continue;
      const quantity = random.int(10, 20);
      const unitCost = Math.round(product.cost * 100 * random.range(0.96, 1.05));
      const amount = quantity * unitCost;
      if (book.balance("negocio") < amount) continue;
      book.post({ kind: "compra_stock", at: atTime(day, 7, random), amountCents: amount, lines: lines("stock", "negocio", amount), productId: product.id, quantity });
      const value = product.quantity * product.avgCostCents + amount;
      product.quantity += quantity;
      product.avgCostCents = Math.round(value / product.quantity);
    }

    if (random.chance(1 / behaviour.homeEvery) && book.balance("negocio") > 80_000) {
      const amount = Math.round(book.balance("negocio") * random.range(0.1, 0.22) / 1000) * 1000;
      book.post({ kind: "transferencia", at: atTime(day, 16, random), amountCents: amount, lines: lines("casa", "negocio", amount), category: "retirada_casa" });
    }
    if (random.chance(0.1) && book.balance("casa") > 40_000) {
      const amount = random.int(8, 30) * 1000;
      book.post({ kind: "despesa", at: atTime(day, 17, random), amountCents: amount, lines: lines("despesas", "casa", amount), category: "casa" });
    }
    if (random.chance(1 / behaviour.saveEvery) && book.balance("negocio") > 60_000) {
      const amount = random.int(2, 6) * 10_000;
      book.post({ kind: "poupanca_deposito", at: atTime(day, 16, random), amountCents: amount, lines: lines("poupanca", "negocio", amount), goalId: person.goalId });
    }
  }
}

function lines(debit: AccountCode, credit: AccountCode, amount: number): EntryLine[] {
  return [
    { account: debit, amountCents: amount },
    { account: credit, amountCents: -amount },
  ];
}

function atTime(day: string, hour: number, random: Random) {
  return new Date(dayStart(day).getTime() + hour * 3_600_000 + random.int(0, 3_500) * 1000);
}

async function insertChunks<T>(rows: T[], size: number, write: (chunk: T[]) => Promise<unknown>) {
  for (let index = 0; index < rows.length; index += size) await write(rows.slice(index, index + size));
}

function sampleDocument(label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" fill="#f4efe3"/><rect x="24" y="24" width="592" height="352" fill="none" stroke="#0f3d33" stroke-width="3" stroke-dasharray="10 8"/><text x="320" y="170" font-family="sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="#0f3d33">DOCUMENTO DE AMOSTRA</text><text x="320" y="214" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#0f3d33">${label}</text><text x="320" y="252" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#7a5a1c">Sem qualquer valor. Dados sintéticos de demonstração.</text></svg>`;
  return Buffer.from(svg);
}

export async function seedIfEmpty(db: Db) {
  const [{ total }] = await db.select({ total: sql<string>`count(*)` }).from(t.users);
  if (Number(total) > 0) return;
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    await seedCore(tx);
    // Synthetic people only exist when explicitly asked for (local testing). A real database starts empty.
    if (isDemo()) await seedDemo(tx);
  });
}

export async function seedDemo(tx: Tx, options: { merchants?: number } = {}) {
  const random = prng(20261101);
  const today = maputoDay();
  const marketRows = await tx.select().from(t.markets);
  const marketBy = (slug: string) => marketRows.find((row) => row.slug === slug) as (typeof marketRows)[number];

  const [system] = await tx.insert(t.users).values({ kind: "staff", role: "admin", email: SYSTEM_EMAIL, displayName: "Sistema", status: "activo", isDemo: true }).returning();
  const staff = new Map<string, string>();
  for (const member of STAFF) {
    const [row] = await tx
      .insert(t.users)
      .values({ kind: "staff", role: member.role, email: member.email, displayName: member.name, passwordHash: await hashSecret(member.password), status: "activo", isDemo: true })
      .returning({ id: t.users.id });
    staff.set(member.role, row.id);
  }

  const policyParams: CreditPolicyParams = {
    isExample: true,
    maxAmountByRing: { base: 1_500_000, second: 3_000_000, third: 6_000_000 },
    termOptionsDays: [14, 30, 45],
    feePercentBasisPoints: 300,
    graceDays: 2,
    defaultAfterDays: 90,
    concentrationLimitPct: 40,
  };
  const [policy] = await tx
    .insert(t.creditPolicies)
    .values({
      version: "2026.11-exemplo",
      status: "aprovada",
      params: policyParams,
      note: "Política de exemplo para demonstração. Limites, prazos e custos não foram validados nem aprovados.",
      createdBy: staff.get("credit_analyst") as string,
      approvedBy: staff.get("credit_approver") as string,
      approvedAt: new Date(),
    })
    .returning();

  const agentRows = new Map<string, { id: string; userId: string; marketId: string }>();
  for (const agent of AGENTS) {
    const [user] = await tx
      .insert(t.users)
      .values({ kind: "agent", role: "agent", phone: agent.phone, displayName: agent.name, status: "activo", isDemo: true })
      .returning({ id: t.users.id });
    const market = marketBy(agent.market);
    const [row] = await tx
      .insert(t.agents)
      .values({ userId: user.id, code: agent.code, marketId: market.id, kioskName: agent.kiosk, kioskHours: agent.hours, status: "activo", trainedAt: new Date() })
      .returning({ id: t.agents.id });
    agentRows.set(agent.market, { id: row.id, userId: user.id, marketId: market.id });
  }

  const supplierRows: { id: string; ownerId: string; name: string; products: { id: string; name: string; unit: string; priceCents: number }[] }[] = [];
  for (const supplier of SUPPLIERS) {
    const [owner] = await tx
      .insert(t.users)
      .values({ kind: "supplier", role: "supplier", phone: supplier.phone, displayName: supplier.name, status: "activo", isDemo: true })
      .returning({ id: t.users.id });
    const [row] = await tx.insert(t.suppliers).values({ ownerId: owner.id, name: supplier.name, category: supplier.category, phone: supplier.phone, status: "activo" }).returning({ id: t.suppliers.id });
    const products = await tx
      .insert(t.supplierProducts)
      .values(supplier.products.map((product) => ({ supplierId: row.id, name: product.name, unit: product.unit, priceCents: product.price * 100 })))
      .returning({ id: t.supplierProducts.id, name: t.supplierProducts.name, unit: t.supplierProducts.unit, priceCents: t.supplierProducts.priceCents });
    supplierRows.push({ id: row.id, ownerId: owner.id, name: supplier.name, products });
  }

  const [model] = await tx.insert(t.deviceModels).values({ name: "Telefone de entrada", priceCents: 650_000, specs: "Modelo por definir: autonomia longa, câmara para documentos, microfone para voz." }).returning();

  // People.
  const total = options.merchants ?? 50;
  const people: Person[] = [];
  const usedNames = new Set<string>(["Celeste Machava", "Armando Cossa", "Rosa Nhantumbo"]);
  const distribution: [string, Profile, Trade][] = [];
  const profileFor = (index: number): Profile => {
    const roll = index / total;
    if (roll < 0.34) return "exemplar";
    if (roll < 0.62) return "constante";
    if (roll < 0.8) return "irregular";
    if (roll < 0.92) return "novo";
    return "parado";
  };
  for (let index = 0; index < total; index += 1) {
    const slug = index < total * 0.56 ? "xipamanine" : index < total * 0.84 ? "zimpeto" : "fajardo";
    distribution.push([slug, profileFor(random.next()) === "exemplar" ? "exemplar" : profileFor(index), TRADES[index % TRADES.length]]);
  }

  const makePerson = async (name: string, phone: string, slug: string, profile: Profile, trade: Trade, stall: string, forcedStart?: string): Promise<Person> => {
    const agent = agentRows.get(slug) as { id: string; userId: string; marketId: string };
    const span = random.int(PROFILE[profile].days[0], PROFILE[profile].days[1]);
    const startDay = forcedStart ?? addDays(today, -span);
    const createdAt = dayStart(startDay);
    const [user] = await tx.insert(t.users).values({ kind: "merchant", role: "merchant", phone, displayName: name, status: "activo", isDemo: true, createdAt }).returning({ id: t.users.id });
    await ensureAccounts(tx, user.id);
    const accountRows = await tx.select({ id: t.accounts.id, code: t.accounts.code }).from(t.accounts).where(eq(t.accounts.userId, user.id));
    const firstName = name.split(" ")[0];
    await tx.insert(t.businesses).values({ ownerId: user.id, agentId: agent.id, marketId: agent.marketId, name: trade.business(firstName), stall, activity: trade.activity, category: trade.category, onboardingStep: 10, onboardedAt: createdAt, createdAt });
    const products = await tx
      .insert(t.products)
      .values(trade.products.map((product) => ({ userId: user.id, name: product.name, unit: product.unit, icon: product.icon, marketCategory: product.pulse ?? null, salePriceCents: product.price * 100, avgCostCents: product.cost * 100, lowStockAt: 6 })))
      .returning({ id: t.products.id, name: t.products.name });
    const customerNames = Array.from({ length: profile === "novo" ? 1 : random.int(2, 5) }, () => `${random.pick(["Mana", "Tia", "Sr.", "Dona", "Mano"])} ${random.pick(FIRST_NAMES)}`);
    const customers = (
      await tx
        .insert(t.customers)
        .values([...new Set(customerNames)].map((customerName) => ({ userId: user.id, name: customerName })))
        .returning({ id: t.customers.id, name: t.customers.name })
    ).map((row) => ({ ...row, owed: 0 }));
    let goalId: string | null = null;
    if (profile === "exemplar" || (profile === "constante" && random.chance(0.6))) {
      const [goal] = await tx
        .insert(t.savingsGoals)
        .values({ userId: user.id, name: random.pick(["Propinas da escola", "Arca congeladora", "Chapa para a banca", "Telhado de casa"]), targetCents: random.int(2, 8) * 1_000_000, targetDate: addDays(today, random.int(30, 150)), createdAt })
        .returning({ id: t.savingsGoals.id });
      goalId = goal.id;
    }
    const person: Person = {
      id: user.id,
      name,
      phone,
      marketId: agent.marketId,
      marketSlug: slug,
      agentId: agent.id,
      agentUserId: agent.userId,
      trade,
      profile,
      book: new Book(user.id, new Map(accountRows.map((row) => [row.code, row.id]))),
      products: products.map((row) => {
        const source = trade.products.find((product) => product.name === row.name) as Trade["products"][number];
        return { id: row.id, name: row.name, unit: source.unit, icon: source.icon, pulse: source.pulse, salePriceCents: source.price * 100, avgCostCents: source.cost * 100, quantity: 0, cost: source.cost, price: source.price };
      }),
      customers,
      goalId,
      startDay,
    };
    people.push(person);
    return person;
  };

  const celeste = await makePerson("Celeste Machava", PERSONA_PHONES.celeste, "xipamanine", "exemplar", TRADES[0], "Rua 4, banca 112", addDays(today, -270));
  const armando = await makePerson("Armando Cossa", PERSONA_PHONES.armando, "zimpeto", "constante", TRADES[2], "Pavilhão B, 27", addDays(today, -125));
  const rosa = await makePerson("Rosa Nhantumbo", PERSONA_PHONES.rosa, "xipamanine", "novo", TRADES[3], "Rua 7, banca 41", addDays(today, -9));
  for (const [index, [slug, profile, trade]] of distribution.entries()) {
    let name = "";
    do name = `${random.pick(FIRST_NAMES)} ${random.pick(SURNAMES)}`;
    while (usedNames.has(name));
    usedNames.add(name);
    await makePerson(name, `+25884${String(2000000 + index * 37).padStart(7, "0")}`, slug, profile, trade, `Banca ${random.int(3, 240)}`);
  }

  // Xitique groups are planned before simulating, so their contributions are part of each person's history.
  const groups: { name: string; market: string; frequency: "semanal" | "quinzenal" | "mensal"; contribution: number; members: Person[]; offline: string[]; mode: "combinada" | "sorteio"; startedDaysAgo: number }[] = [
    { name: "Xitique da Rua 4", market: "xipamanine", frequency: "semanal", contribution: 500, members: [celeste, ...people.filter((person) => person.marketSlug === "xipamanine" && person.profile === "exemplar" && person !== celeste).slice(0, 5)], offline: ["Tia Marta", "Mana Zita"], mode: "combinada", startedDaysAgo: 40 },
    { name: "Grupo do Pavilhão B", market: "zimpeto", frequency: "quinzenal", contribution: 1500, members: [armando, ...people.filter((person) => person.marketSlug === "zimpeto" && person.profile !== "novo" && person !== armando).slice(0, 6)], offline: [], mode: "sorteio", startedDaysAgo: 58 },
    { name: "Mamanas de Fajardo", market: "fajardo", frequency: "mensal", contribution: 2000, members: people.filter((person) => person.marketSlug === "fajardo" && person.profile !== "novo").slice(0, 5), offline: ["Dona Alice"], mode: "combinada", startedDaysAgo: 95 },
    { name: "Peixeiras da Rua 2", market: "xipamanine", frequency: "semanal", contribution: 300, members: people.filter((person) => person.marketSlug === "xipamanine" && person.profile === "constante").slice(0, 5), offline: [], mode: "sorteio", startedDaysAgo: 18 },
  ];

  for (const person of people) simulate(person, today, random);

  const STEP = { semanal: 7, quinzenal: 14, mensal: 30 };
  const xitiqueWrites: { contributions: (typeof t.xitiqueContributions.$inferInsert)[]; events: (typeof t.xitiqueEvents.$inferInsert)[] } = { contributions: [], events: [] };
  for (const plan of groups) {
    if (plan.members.length < 3) continue;
    const seed = randomCode(20);
    const startsOn = addDays(today, -plan.startedDaysAgo);
    const creator = plan.members[0];
    const [group] = await tx
      .insert(t.xitiqueGroups)
      .values({ name: plan.name, code: `UKU-${randomCode(5)}`, createdBy: creator.id, marketId: marketBy(plan.market).id, contributionCents: plan.contribution * 100, frequency: plan.frequency, payoutMode: plan.mode, status: "activo", startsOn, drawCommit: plan.mode === "sorteio" ? sha256(seed) : null, drawSeed: plan.mode === "sorteio" ? seed : null, rules: "Pagar até ao fim do dia marcado. Quem não puder, avisa antes.", createdAt: dayStart(addDays(startsOn, -5)) })
      .returning();
    const members = [
      ...plan.members.map((person, index) => ({ groupId: group.id, userId: person.id, displayName: person.name, role: index === 0 ? ("tesoureiro" as const) : ("membro" as const) })),
      ...plan.offline.map((displayName) => ({ groupId: group.id, userId: null, displayName, role: "membro" as const })),
    ];
    const memberRows = await tx.insert(t.xitiqueMembers).values(members).returning({ id: t.xitiqueMembers.id, userId: t.xitiqueMembers.userId, displayName: t.xitiqueMembers.displayName });
    const order = plan.mode === "sorteio" ? drawOrder(seed, memberRows.map((row) => row.id)) : memberRows.map((row) => row.id);
    for (const [index, memberId] of order.entries()) await tx.update(t.xitiqueMembers).set({ position: index + 1 }).where(eq(t.xitiqueMembers.id, memberId));
    xitiqueWrites.events.push({ groupId: group.id, kind: "grupo_criado", actorId: creator.id, summary: `${creator.name} criou o grupo.`, createdAt: dayStart(addDays(startsOn, -5)) });
    xitiqueWrites.events.push({ groupId: group.id, kind: "grupo_iniciado", actorId: creator.id, summary: plan.mode === "sorteio" ? "O sorteio foi feito e a ordem ficou fixada. Qualquer membro pode conferir." : "A ordem combinada ficou fixada.", createdAt: dayStart(startsOn) });
    for (const [index, memberId] of order.entries()) {
      const dueDate = addDays(startsOn, index * STEP[plan.frequency]);
      const isPast = dueDate < today;
      const isCurrent = !isPast && dueDate <= addDays(today, STEP[plan.frequency]);
      const [round] = await tx
        .insert(t.xitiqueRounds)
        .values({ groupId: group.id, number: index + 1, dueDate, recipientMemberId: memberId, status: isPast ? "paga" : "aberta", paidOutAt: isPast ? dayStart(addDays(dueDate, 1)) : null })
        .returning({ id: t.xitiqueRounds.id });
      for (const member of memberRows) {
        const reliable = member.userId !== null && people.find((person) => person.id === member.userId)?.profile === "exemplar";
        const late = isPast && !reliable && random.chance(0.12);
        const paid = isPast || (isCurrent && random.chance(reliable ? 0.75 : 0.3));
        const declaredBy = member.userId ?? creator.id;
        const secondPerson = memberRows.find((row) => row.userId && row.userId !== creator.id)?.userId ?? null;
        xitiqueWrites.contributions.push({
          roundId: round.id,
          memberId: member.id,
          amountCents: plan.contribution * 100,
          status: paid ? (isPast ? "confirmada" : "declarada") : isPast ? "atrasada" : "pendente",
          declaredAt: paid ? dayStart(dueDate) : null,
          declaredBy: paid ? declaredBy : null,
          confirmedAt: isPast && paid ? dayStart(addDays(dueDate, 1)) : null,
          // Two different people, always: the database refuses anything else.
          confirmedBy: isPast && paid ? (declaredBy === creator.id ? secondPerson : creator.id) : null,
          lateDays: late ? random.int(1, 4) : 0,
        });
        const person = people.find((row) => row.id === member.userId);
        if (paid && person && person.book.entries.length > 0) {
          person.book.post({ kind: "xitique_contribuicao", at: atTime(dueDate > today ? today : dueDate, 15, random), amountCents: plan.contribution * 100, lines: lines("xitique", "negocio", plan.contribution * 100), refType: "xitique_group", refId: group.id });
        }
      }
      if (isPast) {
        const recipient = memberRows.find((row) => row.id === memberId);
        const person = people.find((row) => row.id === recipient?.userId);
        const pot = plan.contribution * 100 * memberRows.length;
        if (person) person.book.post({ kind: "xitique_recebimento", at: atTime(addDays(dueDate, 1), 10, random), amountCents: pot, lines: lines("negocio", "xitique", pot), refType: "xitique_group", refId: group.id, memo: `Ronda ${index + 1}` });
        xitiqueWrites.events.push({ groupId: group.id, kind: "ronda_paga", actorId: recipient?.userId ?? creator.id, summary: `${recipient?.displayName} confirmou que recebeu a ronda ${index + 1}.`, createdAt: dayStart(addDays(dueDate, 1)) });
      }
    }
  }
  const [formation] = await tx.insert(t.xitiqueGroups).values({ name: "Vizinhas da Rua 9", code: "UKU-RUA9X", createdBy: rosa.id, marketId: rosa.marketId, contributionCents: 20_000, frequency: "semanal", payoutMode: "sorteio", status: "formacao", drawCommit: sha256("seed-demo-rua9"), drawSeed: "seed-demo-rua9" }).returning();
  await tx.insert(t.xitiqueMembers).values({ groupId: formation.id, userId: rosa.id, displayName: rosa.name, role: "tesoureiro" });

  // Credit: a healthy book with a few real problems, so the risk room has something honest to show.
  type ContractPlan = { person: Person; supplier: (typeof supplierRows)[number]; principal: number; state: "liquidado" | "activo" | "atraso" | "incumprimento" | "aguarda"; startedDaysAgo: number; lateDays?: number; instalments: number };
  const exemplars = people.filter((person) => person.profile === "exemplar" && person !== celeste);
  const steady = people.filter((person) => person.profile === "constante" && person !== armando);
  const supplierFor = (person: Person) => supplierRows[person.trade.category.includes("Vestuário") ? 2 : person.trade.category.includes("frescos") ? 0 : 1];
  const contractPlans = ([
    { person: celeste, supplier: supplierRows[0], principal: 1_200_000, state: "liquidado", startedDaysAgo: 110, instalments: 2 } as ContractPlan,
    { person: celeste, supplier: supplierRows[0], principal: 2_400_000, state: "activo", startedDaysAgo: 18, instalments: 3 },
    ...exemplars.slice(0, 7).map((person, index): ContractPlan => ({ person, supplier: supplierFor(person), principal: (10 + index * 3) * 100_000, state: index < 2 ? "liquidado" : "activo", startedDaysAgo: index < 2 ? 90 : 12 + index * 2, instalments: 2 + (index % 2) })),
    { person: exemplars[8] ?? steady[0], supplier: supplierRows[1], principal: 1_500_000, state: "aguarda", startedDaysAgo: 1, instalments: 2 },
    { person: steady[0], supplier: supplierRows[0], principal: 1_100_000, state: "atraso", startedDaysAgo: 42, lateDays: 5, instalments: 2 },
    { person: steady[1], supplier: supplierRows[1], principal: 1_400_000, state: "atraso", startedDaysAgo: 52, lateDays: 18, instalments: 2 },
    { person: steady[2], supplier: supplierRows[0], principal: 900_000, state: "atraso", startedDaysAgo: 80, lateDays: 44, instalments: 2 },
    { person: steady[3], supplier: supplierRows[1], principal: 1_000_000, state: "incumprimento", startedDaysAgo: 135, lateDays: 96, instalments: 2 },
  ] as ContractPlan[]).filter((plan) => plan.person);

  for (const plan of contractPlans) {
    const fee = Math.round((plan.principal * policyParams.feePercentBasisPoints) / 10_000);
    const totalDue = plan.principal + fee;
    const termDays = 45;
    const startDay = addDays(today, -plan.startedDaysAgo);
    const item = plan.supplier.products[0];
    const quantity = Math.max(1, Math.round(plan.principal / item.priceCents));
    const [application] = await tx
      .insert(t.creditApplications)
      .values({ code: `CR-${randomCode(6)}`, userId: plan.person.id, supplierId: plan.supplier.id, policyId: policy.id, requestedCents: plan.principal, items: [{ name: item.name, unit: item.unit, quantity, priceCents: item.priceCents }], trustSnapshot: { policyVersion: "2026.11-exemplo", note: "Fotografia sintética" }, status: "aceite", offeredCents: plan.principal, offeredTermDays: termDays, offeredInstalments: plan.instalments, offeredFeeCents: fee, createdAt: dayStart(addDays(startDay, -4)) })
      .returning({ id: t.creditApplications.id });
    await tx.insert(t.creditDecisions).values([
      { applicationId: application.id, stage: "analise", outcome: "recomenda", reasonCodes: ["historial_forte", "xitique_pontual"], note: "Historial regular e bom hábito de separação de bolsos.", actorId: staff.get("credit_analyst") as string, createdAt: dayStart(addDays(startDay, -3)) },
      { applicationId: application.id, stage: "aprovacao", outcome: "aprova", reasonCodes: ["historial_forte"], note: "Valor dentro da fase. Acompanhar a primeira prestação.", actorId: staff.get("credit_approver") as string, createdAt: dayStart(addDays(startDay, -2)) },
    ]);
    const status: t.ContractStatus = plan.state === "liquidado" ? "liquidado" : plan.state === "activo" ? "activo" : plan.state === "atraso" ? "em_atraso" : plan.state === "incumprimento" ? "incumprimento" : "aguarda_entrega";
    const delivered = plan.state !== "aguarda";
    const [contract] = await tx
      .insert(t.creditContracts)
      .values({ code: `CT-${randomCode(6)}`, applicationId: application.id, userId: plan.person.id, supplierId: plan.supplier.id, principalCents: plan.principal, feeCents: fee, termDays, status, termsSnapshot: { policyVersion: "2026.11-exemplo", isExample: true, graceDays: policyParams.graceDays, items: [{ name: item.name, unit: item.unit, quantity, priceCents: item.priceCents }] }, acceptedAt: dayStart(addDays(startDay, -1)), acceptedChannel: "app", deliveryCode: "482915", deliveredAt: delivered ? dayStart(startDay) : null, deliveryConfirmedBy: delivered ? plan.supplier.ownerId : null, settledAt: plan.state === "liquidado" ? dayStart(addDays(startDay, 40)) : null, createdAt: dayStart(addDays(startDay, -1)) })
      .returning({ id: t.creditContracts.id, code: t.creditContracts.code });
    if (!delivered) continue;
    plan.person.book.post({ kind: "credito_stock", at: dayStart(startDay), amountCents: totalDue, lines: [{ account: "stock", amountCents: plan.principal }, { account: "despesas", amountCents: fee }, { account: "divida_fornecedor", amountCents: -totalDue }], recordedBy: plan.supplier.ownerId, channel: "sistema", refType: "credit_contract", refId: contract.id, memo: `Entrega ${contract.code}` });
    const base = Math.floor(totalDue / plan.instalments);
    for (let number = 1; number <= plan.instalments; number += 1) {
      const amount = base + (number === plan.instalments ? totalDue - base * plan.instalments : 0);
      const dueDate = addDays(startDay, Math.round((number * termDays) / plan.instalments));
      const overdue = plan.lateDays !== undefined && number === 1 ? addDays(today, -plan.lateDays) : dueDate;
      const finalDue = plan.lateDays !== undefined ? overdue : dueDate;
      const paidFully = plan.state === "liquidado" || (finalDue < today && plan.lateDays === undefined);
      const late = plan.lateDays !== undefined && number === 1;
      const paidCents = paidFully ? amount : 0;
      await tx.insert(t.creditInstalments).values({ contractId: contract.id, number, dueDate: finalDue, amountCents: amount, paidCents, status: paidFully ? "pago" : late ? "em_atraso" : "por_pagar", paidAt: paidFully ? dayStart(addDays(finalDue, -1)) : null });
      if (paidFully) {
        const entryId = plan.person.book.post({ kind: "credito_pagamento", at: dayStart(addDays(finalDue, -1)), amountCents: amount, lines: lines("divida_fornecedor", "negocio", amount), channel: "agente", recordedBy: plan.person.agentUserId, refType: "credit_contract", refId: contract.id });
        (plan.person as Person & { repayments?: unknown[] }).repayments ??= [];
        ((plan.person as Person & { repayments?: (typeof t.creditRepayments.$inferInsert)[] }).repayments as (typeof t.creditRepayments.$inferInsert)[]).push({ contractId: contract.id, amountCents: amount, method: "M-Pesa", reference: `DEMO-${randomCode(8)}`, recordedBy: plan.person.agentUserId, entryId, paidAt: dayStart(addDays(finalDue, -1)) });
      }
    }
  }

  // Pipeline waiting for people, so analyst and approver have work on screen.
  const pipeline: { person: Person; status: t.ApplicationStatus; cents: number }[] = [
    { person: armando, status: "em_analise", cents: 1_450_000 },
    { person: exemplars[9] ?? steady[4], status: "submetido", cents: 900_000 },
    { person: exemplars[10] ?? steady[5], status: "submetido", cents: 1_300_000 },
    { person: exemplars[11] ?? steady[6], status: "recomendado", cents: 1_100_000 },
    { person: steady[7] ?? rosa, status: "recusado", cents: 1_500_000 },
  ];
  for (const row of pipeline) {
    if (!row.person) continue;
    const supplier = supplierFor(row.person);
    const product = supplier.products[0];
    const [application] = await tx
      .insert(t.creditApplications)
      .values({ code: `CR-${randomCode(6)}`, userId: row.person.id, supplierId: supplier.id, policyId: policy.id, requestedCents: row.cents, items: [{ name: product.name, unit: product.unit, quantity: Math.max(1, Math.round(row.cents / product.priceCents)), priceCents: product.priceCents }], trustSnapshot: { policyVersion: "2026.11-exemplo" }, status: row.status, offeredCents: row.status === "recomendado" ? row.cents : null, offeredTermDays: row.status === "recomendado" ? 30 : null, offeredInstalments: row.status === "recomendado" ? 2 : null, offeredFeeCents: row.status === "recomendado" ? Math.round(row.cents * 0.03) : null })
      .returning({ id: t.creditApplications.id });
    if (row.status === "recomendado") await tx.insert(t.creditDecisions).values({ applicationId: application.id, stage: "analise", outcome: "recomenda", reasonCodes: ["historial_forte", "agente_confirma"], note: "Regularidade forte nos últimos 90 dias e agente confirma a actividade.", actorId: staff.get("credit_analyst") as string });
    if (row.status === "recusado") await tx.insert(t.creditDecisions).values({ applicationId: application.id, stage: "analise", outcome: "recusa", reasonCodes: ["regularidade", "poupanca"], note: "Registo ainda pouco regular. Voltar a avaliar daqui a dois meses.", actorId: staff.get("credit_analyst") as string });
  }

  // Everything accumulated in memory goes to the database now.
  const entries = people.flatMap((person) => person.book.entries);
  const postingRows = people.flatMap((person) => person.book.postings);
  await insertChunks(entries, 400, (chunk) => tx.insert(t.journalEntries).values(chunk));
  await insertChunks(postingRows, 800, (chunk) => tx.insert(t.postings).values(chunk));
  await insertChunks(xitiqueWrites.contributions, 400, (chunk) => tx.insert(t.xitiqueContributions).values(chunk));
  await insertChunks(xitiqueWrites.events, 200, (chunk) => tx.insert(t.xitiqueEvents).values(chunk));
  const repayments = people.flatMap((person) => (person as Person & { repayments?: (typeof t.creditRepayments.$inferInsert)[] }).repayments ?? []);
  if (repayments.length) await tx.insert(t.creditRepayments).values(repayments);
  for (const person of people) {
    for (const product of person.products) await tx.update(t.products).set({ quantity: product.quantity, avgCostCents: product.avgCostCents }).where(eq(t.products.id, product.id));
  }

  // KYC and documents, with a mix of levels and a live review queue.
  const reviewer = staff.get("kyc_reviewer") as string;
  const kycRows: (typeof t.kycProfiles.$inferInsert)[] = [];
  const attestations: (typeof t.kycAttestations.$inferInsert)[] = [];
  const consentRows: (typeof t.consents.$inferInsert)[] = [];
  const documentQueue: { person: Person; type: string; status: t.DocumentStatus; reason?: string }[] = [];
  for (const person of people) {
    const level = person.profile === "exemplar" ? 2 : person.profile === "constante" ? (random.chance(0.7) ? 2 : 1) : person.profile === "novo" ? (random.chance(0.5) ? 1 : 0) : 1;
    kycRows.push({ userId: person.id, level, status: level > 0 ? "verificado" : "em_curso", faceCaptured: level > 0, updatedBy: person.agentUserId });
    if (level > 0) attestations.push({ userId: person.id, agentId: person.agentId, kind: "rosto_confirmado", source: "observado", note: "Confirmado na banca." });
    if (level > 1) {
      attestations.push({ userId: person.id, agentId: person.agentId, kind: "banca_visitada", source: "observado" });
      documentQueue.push({ person, type: random.pick(["bi", "bi", "declaracao_bairro", "cartao_eleitor"]), status: "aprovado" });
    }
    consentRows.push(
      { userId: person.id, purpose: "servico_base", policyVersion: "2026.11", channel: "agente", capturedBy: person.agentUserId },
      { userId: person.id, purpose: "verificacao", policyVersion: "2026.11", channel: "agente", capturedBy: person.agentUserId },
      { userId: person.id, purpose: "voz_ia", policyVersion: "2026.11", channel: "agente", capturedBy: person.agentUserId },
    );
    if (person.profile === "exemplar" || person.profile === "constante") consentRows.push({ userId: person.id, purpose: "historial_credito", policyVersion: "2026.11", channel: "app", capturedBy: person.id });
  }
  await tx.insert(t.kycProfiles).values(kycRows);
  await insertChunks(attestations, 300, (chunk) => tx.insert(t.kycAttestations).values(chunk));
  await insertChunks(consentRows, 300, (chunk) => tx.insert(t.consents).values(chunk));

  const novos = people.filter((person) => person.profile === "novo");
  const queueTypes = ["bi", "declaracao_bairro", "cartao_eleitor", "licenca_mercado", "bi", "nuit"];
  documentQueue.push(...queueTypes.map((type, index) => ({ person: novos[index % novos.length] ?? rosa, type: `${type}`, status: "submetido" as const })));
  documentQueue.push({ person: rosa, type: "bi", status: "rejeitado", reason: "ilegivel" }, { person: people[9], type: "licenca_mercado", status: "rejeitado", reason: "incompleto" });
  const seen = new Set<string>();
  for (const row of documentQueue) {
    const key = `${row.person.id}:${row.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bytes = sampleDocument(`${row.type.toUpperCase()} · ${row.person.name}`);
    const encrypted = encryptBytes(bytes);
    const submittedAt = dayStart(addDays(today, -random.int(0, 6)));
    const reviewed = row.status !== "submetido";
    const [document] = await tx
      .insert(t.documents)
      .values({ userId: row.person.id, type: row.type, numberMasked: `••••${random.int(1000, 9999)}`, status: row.status, storageKey: "db:amostra", mime: "image/svg+xml", sizeBytes: bytes.length, sha256: sha256(`${key}:${randomCode(8)}`), iv: encrypted.iv, authTag: encrypted.authTag, keyId: encrypted.keyId, submittedBy: row.person.agentUserId, submittedAt, reviewerId: reviewed ? reviewer : null, reviewedAt: reviewed ? new Date(submittedAt.getTime() + random.int(2, 26) * 3_600_000) : null, rejectionReason: row.reason ?? null, rejectionNote: row.reason ? "Tirar a fotografia com mais luz." : null })
      .returning({ id: t.documents.id });
    await tx.insert(t.documentBlobs).values({ documentId: document.id, ciphertext: encrypted.ciphertext });
    await tx.insert(t.documentEvents).values({ documentId: document.id, kind: "submetido", actorId: row.person.agentUserId, createdAt: submittedAt });
    if (reviewed) await tx.insert(t.documentEvents).values({ documentId: document.id, kind: row.status, actorId: reviewer });
  }
  await tx.insert(t.kycEvents).values(kycRows.filter((row) => (row.level ?? 0) > 0).slice(0, 30).map((row) => ({ userId: row.userId, fromLevel: 0, toLevel: row.level as number, reason: "Rosto confirmado pelo agente.", actorId: row.updatedBy as string })));

  // Devices, offline sync history and leasing.
  for (const person of people.filter((_, index) => index % 2 === 0)) {
    const [device] = await tx.insert(t.devices).values({ userId: person.id, modelId: model.id, label: "Telefone Ukuphila", status: "activo", lastSyncAt: new Date(Date.now() - random.int(1, 40) * 3_600_000), lastSeq: random.int(40, 900) }).returning({ id: t.devices.id });
    const instalments = 20;
    const paid = random.int(3, 16);
    const [lease] = await tx.insert(t.deviceLeases).values({ code: `LS-${randomCode(6)}`, deviceId: device.id, userId: person.id, agentId: person.agentId, instalmentCents: 35_000, instalments, startedAt: dayStart(addDays(today, -paid * 7)) }).returning({ id: t.deviceLeases.id });
    await tx.insert(t.leasePayments).values(Array.from({ length: instalments }, (_, index) => {
      const dueDate = addDays(today, (index + 1 - paid) * 7);
      const isPaid = index < paid;
      return { leaseId: lease.id, number: index + 1, dueDate, amountCents: 35_000, status: isPaid ? ("pago" as const) : dueDate < today ? ("em_atraso" as const) : ("por_pagar" as const), paidAt: isPaid ? dayStart(dueDate) : null };
    }));
  }
  const syncRows: (typeof t.syncOps.$inferInsert)[] = [];
  const conflictRows: (typeof t.syncConflicts.$inferInsert)[] = [];
  for (let index = 0; index < 260; index += 1) {
    const person = random.pick(people);
    const opId = randomUUID();
    const roll = random.next();
    const status: t.SyncOpStatus = roll < 0.955 ? "applied" : roll < 0.985 ? "conflict" : "rejected";
    syncRows.push({ opId, userId: person.id, type: random.pick(["sale.record", "sale.record", "expense.record", "stock.purchase"]), payload: { demo: true }, status, clientTime: new Date(Date.now() - random.int(1, 28 * 24) * 3_600_000), result: { demo: true } });
    if (status === "conflict" && conflictRows.length < 9) conflictRows.push({ userId: person.id, opId, kind: random.pick(["stock_negativo", "saldo_negativo", "cadeia_quebrada"]), message: "Registo guardado para confirmar com o comerciante." });
  }
  await insertChunks(syncRows, 200, (chunk) => tx.insert(t.syncOps).values(chunk));
  if (conflictRows.length) await tx.insert(t.syncConflicts).values(conflictRows);

  // Field work: visits, incidents, earnings.
  const visitRows: (typeof t.visits.$inferInsert)[] = [];
  const earningRows: (typeof t.agentEarnings.$inferInsert)[] = [];
  const rates = await getSetting(tx, "agentRates");
  const businessRows = await tx.select({ id: t.businesses.id, ownerId: t.businesses.ownerId }).from(t.businesses);
  for (const person of people) {
    const business = businessRows.find((row) => row.ownerId === person.id) as { id: string };
    for (let count = random.int(1, 4); count > 0; count -= 1) {
      visitRows.push({ agentId: person.agentId, businessId: business.id, purpose: random.pick(["Acompanhamento", "Apoio ao registo", "Educação financeira", "Documentos"]), outcome: random.pick(["Resolvido", "Resolvido", "Voltar a passar", "Sem novidade"]), at: new Date(Date.now() - random.int(1, 30) * 86_400_000) });
    }
    earningRows.push({ agentId: person.agentId, kind: "registo", amountCents: rates.onboardingCents, subjectUserId: person.id, createdAt: dayStart(person.startDay) });
  }
  await insertChunks(visitRows, 300, (chunk) => tx.insert(t.visits).values(chunk));
  await insertChunks(earningRows, 300, (chunk) => tx.insert(t.agentEarnings).values(chunk));
  const incidentPlan: { kind: t.IncidentKind; severity: "baixa" | "media" | "alta"; title: string; description: string; person: Person; status?: "aberto" | "em_curso" | "resolvido" }[] = [
    { kind: "suporte", severity: "media", title: "Não consegue ver a poupança", description: "Pede ajuda para encontrar a meta na aplicação.", person: rosa },
    { kind: "dispositivo", severity: "alta", title: "Telefone perdido no mercado", description: "Comerciante diz que perdeu o telefone na quinta-feira.", person: people[12] },
    { kind: "documento", severity: "media", title: "Fotografia do BI recusada duas vezes", description: "A luz da banca dificulta a fotografia.", person: people[9] },
    { kind: "sync", severity: "baixa", title: "Registos pendentes há dois dias", description: "O telefone fica sem dados ao fim do dia.", person: people[20], status: "em_curso" },
    { kind: "reclamacao", severity: "media", title: "Valor de um registo do agente", description: "Comerciante não reconhece um registo feito no quiosque.", person: people[15] },
    { kind: "suporte", severity: "baixa", title: "Como mudar o PIN", description: "Resolvido com o agente.", person: people[5], status: "resolvido" },
  ];
  for (const row of incidentPlan) {
    await tx.insert(t.incidents).values({ code: `INC-${randomCode(5)}`, kind: row.kind, severity: row.severity, status: row.status ?? "aberto", title: row.title, description: row.description, subjectUserId: row.person.id, openedBy: row.person.agentUserId, resolution: row.status === "resolvido" ? "Explicado no quiosque." : null, resolvedAt: row.status === "resolvido" ? new Date() : null, createdAt: new Date(Date.now() - random.int(2, 90) * 3_600_000) });
  }

  // Risk: open alerts and one investigation in progress.
  const analyst = staff.get("risk_analyst") as string;
  const [riskCase] = await tx.insert(t.riskCases).values({ code: `RC-${randomCode(5)}`, title: "Contrato em incumprimento em Xipamanine", kind: "credito", severity: "alta", status: "em_investigacao", ownerId: analyst, subjectUserId: steady[3]?.id ?? null, summary: "Mais de 90 dias de atraso depois de uma quebra nas vendas. Agente confirma doença na família." }).returning({ id: t.riskCases.id });
  await tx.insert(t.riskCaseNotes).values({ caseId: riskCase.id, actorId: analyst, note: "Pedi ao agente uma visita. Avaliar plano de pagamento com o fornecedor." });
  const alertPlan: (typeof t.riskAlerts.$inferInsert)[] = [
    { rule: "credito_atraso", severity: "alta", title: "Contrato com 96 dias de atraso", detail: "Prestação em atraso há mais de 90 dias.", subjectUserId: steady[3]?.id, caseId: riskCase.id, status: "em_revisao", dedupeKey: "demo:atraso:96" },
    { rule: "credito_atraso", severity: "alta", title: "Contrato com 44 dias de atraso", detail: "Prestação 1 com 44 dias de atraso.", subjectUserId: steady[2]?.id, dedupeKey: "demo:atraso:44" },
    { rule: "credito_atraso", severity: "media", title: "Contrato com 18 dias de atraso", detail: "Prestação 1 com 18 dias de atraso.", subjectUserId: steady[1]?.id, dedupeKey: "demo:atraso:18" },
    { rule: "documento_repetido", severity: "alta", title: "O mesmo ficheiro em duas contas", detail: "Um documento idêntico foi submetido para outra pessoa. Pode ser erro do agente ou tentativa de fraude.", subjectUserId: novos[1]?.id ?? rosa.id, dedupeKey: "demo:documento" },
    { rule: "venda_fora_do_padrao", severity: "media", title: "Dia de vendas muito acima do habitual", detail: "Registo de um dia seis vezes acima da mediana. Confirmar com o agente.", subjectUserId: people[23]?.id, dedupeKey: "demo:pico" },
    { rule: "offline_cadeia_quebrada", severity: "media", title: "Sequência offline quebrada", detail: "Um dispositivo enviou registos fora de ordem. Pode ser reinstalação ou manipulação local.", subjectUserId: people[28]?.id, dedupeKey: "demo:cadeia" },
    { rule: "silencio", severity: "baixa", title: "Comerciante deixou de registar", detail: "Sem registos há mais de duas semanas. Pedir ao agente uma visita.", subjectUserId: people.find((person) => person.profile === "parado")?.id, dedupeKey: "demo:silencio" },
    { rule: "concentracao", severity: "media", title: "Concentração por fornecedor: Frescos da Matola", detail: "Mais de 40% da exposição num único fornecedor.", dedupeKey: "demo:concentracao" },
  ];
  await tx.insert(t.riskAlerts).values(alertPlan);

  // Assistant and WhatsApp history.
  const samples: { input: string; intent: string; response: string; escalated?: boolean; guardrails?: string[]; sources?: string[] }[] = [
    { input: "Vendi duas caixas de tomate por 2000", intent: "RECORD_SALE", response: "Venda: 2 tomate por 2 000 MT. Confirmas? Responde SIM ou NÃO.", guardrails: ["proposta_sem_execucao"] },
    { input: "Quanto tenho?", intent: "CHECK_BALANCE", response: "Negócio: 8 420 MT · Casa: 1 310 MT · Poupança: 5 600 MT.", guardrails: ["dados_do_sistema_transaccional"] },
    { input: "Vou ter crédito aprovado?", intent: "CREDIT_INFO", response: "A IA não deve prometer aprovação. A autoridade é da política formal do produto.", guardrails: ["so_conhecimento_aprovado"], sources: ["UKP-020"] },
    { input: "Quero falar com alguém", intent: "HUMAN_SUPPORT", response: "Certo. O teu agente vai falar contigo.", escalated: true, guardrails: ["escalado_para_humano"] },
    { input: "Como foi hoje?", intent: "DAILY_SUMMARY", response: "Hoje vendeste 3 150 MT e gastaste 120 MT.", guardrails: ["dados_do_sistema_transaccional"] },
    { input: "Quanto falta para o Xitique?", intent: "XITIQUE_STATUS", response: "Xitique da Rua 4: falta pagares 500 MT até sexta-feira.", guardrails: ["dados_do_sistema_transaccional"] },
    { input: "asdf 300", intent: "UNKNOWN", response: "Vi 300 MT. Foi uma venda, uma despesa ou uma compra?" },
  ];
  const turnRows: (typeof t.aiTurns.$inferInsert)[] = [];
  for (let index = 0; index < 180; index += 1) {
    const sample = random.pick(samples);
    turnRows.push({ userId: random.pick(people).id, channel: random.chance(0.6) ? "whatsapp" : "voz", input: sample.input, intent: sample.intent, confidence: random.range(0.7, 0.98), engine: "regras", response: sample.response, escalated: sample.escalated ?? false, guardrails: sample.guardrails ?? null, sources: sample.sources ?? null, latencyMs: random.int(30, 240), createdAt: new Date(Date.now() - random.int(1, 28 * 24) * 3_600_000) });
  }
  await insertChunks(turnRows, 200, (chunk) => tx.insert(t.aiTurns).values(chunk));

  await tx.insert(t.notifications).values([
    { userId: celeste.id, title: "Stock a acabar", body: "O tomate está quase no fim.", link: "/app/stock" },
    { userId: celeste.id, title: "Ronda da semana", body: "A tua contribuição do Xitique da Rua 4 é até sexta-feira.", link: "/app/xitique" },
    { userId: rosa.id, title: "Precisamos de outra fotografia", body: "A fotografia não se lê bem. O teu agente pode ajudar.", link: "/app/documentos" },
  ]);
  await tx.insert(t.leads).values([
    { kind: "fornecedor", name: "Distribuidor de exemplo", organisation: "Exemplo Lda", phone: "+258840000099", message: "Quero saber como funciona o crédito fornecedor.", status: "novo" },
    { kind: "parceiro", name: "Contacto de exemplo", organisation: "Instituição de exemplo", email: "parceiro@exemplo.mz", message: "Interesse em conversar sobre o piloto.", status: "novo" },
  ]);

  // Evaluations last, because they read everything above.
  const trustPolicy = await getSetting(tx, "trustPolicy");
  const evaluations: (typeof t.trustEvaluations.$inferInsert)[] = [];
  for (const person of people) {
    const result = evaluateTrust(await gatherFacts(tx, person.id), trustPolicy);
    evaluations.push({ userId: person.id, policyVersion: result.policyVersion, ring: result.ring, readiness: result.readiness, signals: result.signals });
  }
  await tx.insert(t.trustEvaluations).values(evaluations);

  // Readiness shows real status for the demo programme: documented by the team, not validated by third parties.
  await tx.update(t.readinessItems).set({ status: "em_curso", owner: "Produto" }).where(sql`${t.readinessItems.title} in ('Produto definido', 'Operações documentadas', 'Métricas definidas', 'Modo offline testado em condições reais')`);

  for (const [action, subjectType, role] of [
    ["sistema.dados_demonstracao", "system", "sistema"],
    ["politica.aprovada", "credit_policy", "credit_approver"],
    ["documento.aprovado", "document", "kyc_reviewer"],
    ["credito.decisao_aprova", "credit_application", "credit_approver"],
    ["agente.registo_assistido", "op", "agent"],
    ["dispositivo.perdido", "device", "agent"],
  ] as const) {
    await recordAudit(tx, { actorId: system.id, actorRole: role, action, subjectType, data: { demo: true } });
  }
}
