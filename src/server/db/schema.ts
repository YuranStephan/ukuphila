import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * Ukuphila data model. Sections follow the bounded contexts in docs/ARCHITECTURE.md.
 *
 * Money is integer centavos everywhere (`*_cents`). `journal_entries`, `postings`, `audit_events`, `access_log`,
 * `kyc_events`, `document_events`, `xitique_events`, `credit_decisions` and `sync_ops` are append-only: a database
 * trigger refuses UPDATE/DELETE (see drizzle/0001_integrity.sql). Corrections are new rows, never edits.
 */

const bytea = customType<{ data: Buffer | Uint8Array; driverData: Buffer | Uint8Array }>({ dataType: () => "bytea" });

const id = () => uuid("id").primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();

// ── Geography ───────────────────────────────────────────────────────────────

export const markets = pgTable("markets", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  district: text("district").notNull(),
  city: text("city").notNull().default("Maputo"),
  stage: text("stage").$type<"piloto" | "planeado" | "pausado">().notNull().default("planeado"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  blurb: text("blurb"),
  createdAt: createdAt(),
});

// ── Identity ────────────────────────────────────────────────────────────────

export type UserKind = "merchant" | "agent" | "supplier" | "staff";
export type Role =
  | "merchant"
  | "agent"
  | "supplier"
  | "kyc_reviewer"
  | "credit_analyst"
  | "credit_approver"
  | "risk_analyst"
  | "admin"
  | "auditor";

export const users = pgTable(
  "users",
  {
    id: id(),
    kind: text("kind").$type<UserKind>().notNull(),
    role: text("role").$type<Role>().notNull(),
    phone: text("phone").unique(),
    email: text("email").unique(),
    displayName: text("display_name").notNull(),
    legalName: text("legal_name"),
    language: text("language").notNull().default("pt-MZ"),
    status: text("status").$type<"preliminar" | "activo" | "suspenso" | "encerrado">().notNull().default("preliminar"),
    passwordHash: text("password_hash"),
    pinHash: text("pin_hash"),
    pinFailures: integer("pin_failures").notNull().default(0),
    totpSecret: text("totp_secret"),
    totpEnabledAt: ts("totp_enabled_at"),
    isDemo: boolean("is_demo").notNull().default(false),
    lastSeenAt: ts("last_seen_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("users_role_idx").on(t.role),
    check("users_contact_ck", sql`${t.phone} is not null or ${t.email} is not null`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    deviceId: uuid("device_id"),
    userAgent: text("user_agent"),
    mfaAt: ts("mfa_at"),
    createdAt: createdAt(),
    lastUsedAt: ts("last_used_at"),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: id(),
    phone: text("phone").notNull(),
    purpose: text("purpose").$type<"entrar" | "registo" | "pin">().notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("otp_phone_idx").on(t.phone, t.createdAt)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: ts("window_start").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
});

export const agents = pgTable("agents", {
  id: id(),
  userId: uuid("user_id").notNull().unique().references(() => users.id),
  code: text("code").notNull().unique(),
  marketId: uuid("market_id").notNull().references(() => markets.id),
  kioskName: text("kiosk_name").notNull(),
  kioskHours: text("kiosk_hours"),
  status: text("status").$type<"em_formacao" | "activo" | "suspenso">().notNull().default("em_formacao"),
  trainedAt: ts("trained_at"),
  createdAt: createdAt(),
});

export const businesses = pgTable(
  "businesses",
  {
    id: id(),
    ownerId: uuid("owner_id").notNull().unique().references(() => users.id),
    agentId: uuid("agent_id").references(() => agents.id),
    marketId: uuid("market_id").notNull().references(() => markets.id),
    name: text("name").notNull(),
    stall: text("stall"),
    activity: text("activity").notNull(),
    category: text("category").notNull(),
    altContact: text("alt_contact"),
    onboardingStep: integer("onboarding_step").notNull().default(0),
    onboardedAt: ts("onboarded_at"),
    createdAt: createdAt(),
  },
  (t) => [index("businesses_market_idx").on(t.marketId), index("businesses_agent_idx").on(t.agentId)],
);

// ── KYC, documents, consent ─────────────────────────────────────────────────

export const kycProfiles = pgTable("kyc_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  level: integer("level").notNull().default(0),
  status: text("status").$type<"por_iniciar" | "em_curso" | "verificado" | "em_revisao">().notNull().default("por_iniciar"),
  faceCaptured: boolean("face_captured").notNull().default(false),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
});

export const kycEvents = pgTable(
  "kyc_events",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    fromLevel: integer("from_level").notNull(),
    toLevel: integer("to_level").notNull(),
    reason: text("reason").notNull(),
    actorId: uuid("actor_id").notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("kyc_events_user_idx").on(t.userId, t.createdAt)],
);

/** What an agent saw (observado) kept apart from what the person said (declarado). KB §9.3. */
export const kycAttestations = pgTable(
  "kyc_attestations",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    kind: text("kind").$type<"rosto_confirmado" | "banca_visitada" | "conhece_pessoa" | "morada_referida" | "actividade_confirmada">().notNull(),
    source: text("source").$type<"observado" | "declarado">().notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("kyc_attest_user_idx").on(t.userId)],
);

export type DocumentStatus = "pendente" | "submetido" | "em_revisao" | "aprovado" | "rejeitado" | "expirado";

export const documents = pgTable(
  "documents",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    type: text("type").notNull(),
    numberMasked: text("number_masked"),
    status: text("status").$type<DocumentStatus>().notNull().default("pendente"),
    version: integer("version").notNull().default(1),
    supersedesId: uuid("supersedes_id"),
    storageKey: text("storage_key"),
    mime: text("mime"),
    sizeBytes: integer("size_bytes"),
    sha256: text("sha256"),
    iv: text("iv"),
    authTag: text("auth_tag"),
    keyId: text("key_id"),
    submittedBy: uuid("submitted_by").references(() => users.id),
    submittedAt: ts("submitted_at"),
    reviewerId: uuid("reviewer_id").references(() => users.id),
    reviewedAt: ts("reviewed_at"),
    rejectionReason: text("rejection_reason"),
    rejectionNote: text("rejection_note"),
    expiryDate: date("expiry_date"),
    createdAt: createdAt(),
  },
  (t) => [
    index("documents_user_idx").on(t.userId),
    index("documents_status_idx").on(t.status),
    check("documents_rejected_reason_ck", sql`${t.status} <> 'rejeitado' or ${t.rejectionReason} is not null`),
  ],
);

/** Ciphertext only: AES-256-GCM happens in the application, so a database read alone exposes no document. */
export const documentBlobs = pgTable("document_blobs", {
  documentId: uuid("document_id").primaryKey().references(() => documents.id),
  ciphertext: bytea("ciphertext").notNull(),
});

export const documentEvents = pgTable(
  "document_events",
  {
    id: id(),
    documentId: uuid("document_id").notNull().references(() => documents.id),
    kind: text("kind").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("document_events_doc_idx").on(t.documentId)],
);

export const consents = pgTable(
  "consents",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    purpose: text("purpose").notNull(),
    policyVersion: text("policy_version").notNull(),
    status: text("status").$type<"concedido" | "revogado">().notNull().default("concedido"),
    channel: text("channel").notNull(),
    capturedBy: uuid("captured_by").references(() => users.id),
    grantedAt: ts("granted_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("consents_user_idx").on(t.userId, t.purpose)],
);

/** "Quem viu os meus dados": every staff or agent read of a merchant's data, shown back to that merchant. */
export const accessLog = pgTable(
  "access_log",
  {
    id: id(),
    subjectId: uuid("subject_id").notNull().references(() => users.id),
    actorId: uuid("actor_id").notNull().references(() => users.id),
    actorRole: text("actor_role").notNull(),
    purpose: text("purpose").notNull(),
    resource: text("resource").notNull(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("access_log_subject_idx").on(t.subjectId, t.at)],
);

// ── Financial core: double-entry memo ledger ────────────────────────────────

export type AccountCode =
  | "negocio"
  | "casa"
  | "poupanca"
  | "xitique"
  | "stock"
  | "fiado"
  | "receita"
  | "custo_vendas"
  | "despesas"
  | "capital"
  | "divida_fornecedor"
  | "correccoes";

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    code: text("code").$type<AccountCode>().notNull(),
    kind: text("kind").$type<"bolso" | "activo" | "passivo" | "resultado">().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("accounts_user_code_uq").on(t.userId, t.code)],
);

export type EntryKind =
  | "venda"
  | "venda_fiado"
  | "fiado_recebido"
  | "despesa"
  | "compra_stock"
  | "ajuste_stock"
  | "transferencia"
  | "entrada_capital"
  | "poupanca_deposito"
  | "poupanca_levantamento"
  | "xitique_contribuicao"
  | "xitique_recebimento"
  | "credito_stock"
  | "credito_pagamento"
  | "leasing_pagamento"
  | "estorno";

export type Channel = "app" | "voz" | "whatsapp" | "agente" | "sms" | "sistema";

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    seq: bigint("seq", { mode: "number" }).notNull(),
    kind: text("kind").$type<EntryKind>().notNull(),
    occurredAt: ts("occurred_at").notNull(),
    recordedAt: ts("recorded_at").notNull().defaultNow(),
    channel: text("channel").$type<Channel>().notNull(),
    recordedBy: uuid("recorded_by").notNull().references(() => users.id),
    opId: uuid("op_id").unique(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    category: text("category"),
    memo: text("memo"),
    productId: uuid("product_id"),
    quantity: integer("quantity"),
    customerId: uuid("customer_id"),
    goalId: uuid("goal_id"),
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    reversesId: uuid("reverses_id"),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewNote: text("review_note"),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull(),
  },
  (t) => [
    uniqueIndex("journal_user_seq_uq").on(t.userId, t.seq),
    uniqueIndex("journal_reversal_uq").on(t.reversesId).where(sql`${t.reversesId} is not null`),
    index("journal_user_time_idx").on(t.userId, t.occurredAt),
    index("journal_kind_time_idx").on(t.kind, t.occurredAt),
    check("journal_amount_ck", sql`${t.amountCents} > 0`),
  ],
);

export const postings = pgTable(
  "postings",
  {
    id: id(),
    entryId: uuid("entry_id").notNull().references(() => journalEntries.id),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  },
  (t) => [
    index("postings_account_idx").on(t.accountId),
    index("postings_entry_idx").on(t.entryId),
    check("postings_nonzero_ck", sql`${t.amountCents} <> 0`),
  ],
);

export const entryReviews = pgTable(
  "entry_reviews",
  {
    id: id(),
    entryId: uuid("entry_id").notNull().references(() => journalEntries.id),
    outcome: text("outcome").$type<"mantido" | "estornado">().notNull(),
    note: text("note"),
    actorId: uuid("actor_id").notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("entry_reviews_entry_idx").on(t.entryId)],
);

// ── Business management ─────────────────────────────────────────────────────

export const products = pgTable(
  "products",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    unit: text("unit").notNull().default("unidade"),
    icon: text("icon").notNull().default("caixa"),
    marketCategory: text("market_category"),
    salePriceCents: bigint("sale_price_cents", { mode: "number" }),
    avgCostCents: bigint("avg_cost_cents", { mode: "number" }).notNull().default(0),
    quantity: integer("quantity").notNull().default(0),
    lowStockAt: integer("low_stock_at").notNull().default(5),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("products_user_name_uq").on(t.userId, t.name)],
);

export const stockMoves = pgTable(
  "stock_moves",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    productId: uuid("product_id").notNull().references(() => products.id),
    entryId: uuid("entry_id").references(() => journalEntries.id),
    kind: text("kind").$type<"compra" | "venda" | "ajuste" | "perda" | "credito" | "estorno">().notNull(),
    quantity: integer("quantity").notNull(),
    unitCostCents: bigint("unit_cost_cents", { mode: "number" }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("stock_moves_product_idx").on(t.productId, t.createdAt)],
);

export const customers = pgTable(
  "customers",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    phone: text("phone"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("customers_user_name_uq").on(t.userId, t.name)],
);

export const savingsGoals = pgTable(
  "savings_goals",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    targetCents: bigint("target_cents", { mode: "number" }).notNull(),
    targetDate: date("target_date"),
    status: text("status").$type<"activa" | "cumprida" | "cancelada">().notNull().default("activa"),
    createdAt: createdAt(),
  },
  (t) => [index("savings_goals_user_idx").on(t.userId)],
);

// ── Xitique ─────────────────────────────────────────────────────────────────

export const xitiqueGroups = pgTable(
  "xitique_groups",
  {
    id: id(),
    name: text("name").notNull(),
    code: text("code").notNull().unique(),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    marketId: uuid("market_id").references(() => markets.id),
    contributionCents: bigint("contribution_cents", { mode: "number" }).notNull(),
    frequency: text("frequency").$type<"semanal" | "quinzenal" | "mensal">().notNull(),
    payoutMode: text("payout_mode").$type<"combinada" | "sorteio">().notNull().default("combinada"),
    status: text("status").$type<"formacao" | "activo" | "concluido" | "suspenso">().notNull().default("formacao"),
    rules: text("rules"),
    drawCommit: text("draw_commit"),
    drawSeed: text("draw_seed"),
    startsOn: date("starts_on"),
    createdAt: createdAt(),
  },
  (t) => [check("xitique_contribution_ck", sql`${t.contributionCents} > 0`)],
);

export const xitiqueMembers = pgTable(
  "xitique_members",
  {
    id: id(),
    groupId: uuid("group_id").notNull().references(() => xitiqueGroups.id),
    userId: uuid("user_id").references(() => users.id),
    displayName: text("display_name").notNull(),
    phone: text("phone"),
    position: integer("position"),
    role: text("role").$type<"membro" | "tesoureiro">().notNull().default("membro"),
    status: text("status").$type<"activo" | "saiu">().notNull().default("activo"),
    joinedAt: ts("joined_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("xitique_member_user_uq").on(t.groupId, t.userId).where(sql`${t.userId} is not null`),
    uniqueIndex("xitique_member_position_uq").on(t.groupId, t.position).where(sql`${t.position} is not null`),
    index("xitique_members_user_idx").on(t.userId),
  ],
);

export const xitiqueRounds = pgTable(
  "xitique_rounds",
  {
    id: id(),
    groupId: uuid("group_id").notNull().references(() => xitiqueGroups.id),
    number: integer("number").notNull(),
    dueDate: date("due_date").notNull(),
    recipientMemberId: uuid("recipient_member_id").notNull().references(() => xitiqueMembers.id),
    status: text("status").$type<"aberta" | "fechada" | "paga">().notNull().default("aberta"),
    paidOutAt: ts("paid_out_at"),
    paidOutConfirmedBy: uuid("paid_out_confirmed_by").references(() => users.id),
  },
  (t) => [uniqueIndex("xitique_round_uq").on(t.groupId, t.number)],
);

export const xitiqueContributions = pgTable(
  "xitique_contributions",
  {
    id: id(),
    roundId: uuid("round_id").notNull().references(() => xitiqueRounds.id),
    memberId: uuid("member_id").notNull().references(() => xitiqueMembers.id),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    status: text("status").$type<"pendente" | "declarada" | "confirmada" | "atrasada">().notNull().default("pendente"),
    declaredAt: ts("declared_at"),
    declaredBy: uuid("declared_by").references(() => users.id),
    confirmedAt: ts("confirmed_at"),
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    lateDays: integer("late_days").notNull().default(0),
  },
  (t) => [
    uniqueIndex("xitique_contribution_uq").on(t.roundId, t.memberId),
    check("xitique_two_people_ck", sql`${t.confirmedBy} is null or ${t.declaredBy} is null or ${t.confirmedBy} <> ${t.declaredBy}`),
  ],
);

export const xitiqueEvents = pgTable(
  "xitique_events",
  {
    id: id(),
    groupId: uuid("group_id").notNull().references(() => xitiqueGroups.id),
    kind: text("kind").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    summary: text("summary").notNull(),
    data: jsonb("data"),
    createdAt: createdAt(),
  },
  (t) => [index("xitique_events_group_idx").on(t.groupId, t.createdAt)],
);

// ── Supplier credit ─────────────────────────────────────────────────────────

export const suppliers = pgTable("suppliers", {
  id: id(),
  ownerId: uuid("owner_id").unique().references(() => users.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  phone: text("phone"),
  city: text("city").notNull().default("Maputo"),
  status: text("status").$type<"candidato" | "activo" | "suspenso">().notNull().default("candidato"),
  createdAt: createdAt(),
});

export const supplierProducts = pgTable(
  "supplier_products",
  {
    id: id(),
    supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    priceCents: bigint("price_cents", { mode: "number" }).notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("supplier_products_idx").on(t.supplierId)],
);

export type CreditPolicyParams = {
  isExample: boolean;
  maxAmountByRing: { base: number; second: number; third: number };
  termOptionsDays: number[];
  feePercentBasisPoints: number;
  graceDays: number;
  defaultAfterDays: number;
  concentrationLimitPct: number;
};

export const creditPolicies = pgTable(
  "credit_policies",
  {
    id: id(),
    version: text("version").notNull().unique(),
    status: text("status").$type<"rascunho" | "aprovada" | "arquivada">().notNull().default("rascunho"),
    params: jsonb("params").$type<CreditPolicyParams>().notNull(),
    note: text("note"),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: ts("approved_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("credit_policy_one_active_uq").on(t.status).where(sql`${t.status} = 'aprovada'`),
    check("credit_policy_four_eyes_ck", sql`${t.approvedBy} is null or ${t.approvedBy} <> ${t.createdBy}`),
  ],
);

export type ApplicationStatus =
  | "submetido"
  | "em_analise"
  | "recomendado"
  | "aprovado"
  | "recusado"
  | "aceite"
  | "desistido"
  | "expirado";

export const creditApplications = pgTable(
  "credit_applications",
  {
    id: id(),
    code: text("code").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id),
    supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
    policyId: uuid("policy_id").notNull().references(() => creditPolicies.id),
    requestedCents: bigint("requested_cents", { mode: "number" }).notNull(),
    items: jsonb("items").$type<{ name: string; unit: string; quantity: number; priceCents: number }[]>().notNull(),
    trustSnapshot: jsonb("trust_snapshot").notNull(),
    status: text("status").$type<ApplicationStatus>().notNull().default("submetido"),
    offeredCents: bigint("offered_cents", { mode: "number" }),
    offeredTermDays: integer("offered_term_days"),
    offeredInstalments: integer("offered_instalments"),
    offeredFeeCents: bigint("offered_fee_cents", { mode: "number" }),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("credit_app_status_idx").on(t.status),
    index("credit_app_user_idx").on(t.userId),
    check("credit_requested_ck", sql`${t.requestedCents} > 0`),
  ],
);

export const creditDecisions = pgTable(
  "credit_decisions",
  {
    id: id(),
    applicationId: uuid("application_id").notNull().references(() => creditApplications.id),
    stage: text("stage").$type<"analise" | "aprovacao">().notNull(),
    outcome: text("outcome").$type<"recomenda" | "aprova" | "recusa" | "devolve">().notNull(),
    reasonCodes: jsonb("reason_codes").$type<string[]>().notNull(),
    note: text("note").notNull(),
    actorId: uuid("actor_id").notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("credit_decisions_app_idx").on(t.applicationId)],
);

export type ContractStatus = "aguarda_entrega" | "activo" | "em_atraso" | "incumprimento" | "liquidado" | "cancelado";

export const creditContracts = pgTable(
  "credit_contracts",
  {
    id: id(),
    code: text("code").notNull().unique(),
    applicationId: uuid("application_id").notNull().unique().references(() => creditApplications.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
    principalCents: bigint("principal_cents", { mode: "number" }).notNull(),
    feeCents: bigint("fee_cents", { mode: "number" }).notNull().default(0),
    termDays: integer("term_days").notNull(),
    status: text("status").$type<ContractStatus>().notNull().default("aguarda_entrega"),
    termsSnapshot: jsonb("terms_snapshot").notNull(),
    acceptedAt: ts("accepted_at").notNull(),
    acceptedChannel: text("accepted_channel").notNull(),
    deliveryCode: text("delivery_code").notNull(),
    deliveredAt: ts("delivered_at"),
    deliveryConfirmedBy: uuid("delivery_confirmed_by").references(() => users.id),
    settledAt: ts("settled_at"),
    createdAt: createdAt(),
  },
  (t) => [index("credit_contract_user_idx").on(t.userId), index("credit_contract_status_idx").on(t.status)],
);

export const creditInstalments = pgTable(
  "credit_instalments",
  {
    id: id(),
    contractId: uuid("contract_id").notNull().references(() => creditContracts.id),
    number: integer("number").notNull(),
    dueDate: date("due_date").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    paidCents: bigint("paid_cents", { mode: "number" }).notNull().default(0),
    status: text("status").$type<"por_pagar" | "parcial" | "pago" | "em_atraso">().notNull().default("por_pagar"),
    paidAt: ts("paid_at"),
  },
  (t) => [
    uniqueIndex("credit_instalment_uq").on(t.contractId, t.number),
    index("credit_instalment_due_idx").on(t.dueDate),
    check("credit_paid_ck", sql`${t.paidCents} >= 0 and ${t.paidCents} <= ${t.amountCents}`),
  ],
);

export const creditRepayments = pgTable(
  "credit_repayments",
  {
    id: id(),
    contractId: uuid("contract_id").notNull().references(() => creditContracts.id),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    method: text("method").notNull(),
    reference: text("reference").notNull().unique(),
    recordedBy: uuid("recorded_by").notNull().references(() => users.id),
    entryId: uuid("entry_id").references(() => journalEntries.id),
    paidAt: ts("paid_at").notNull().defaultNow(),
  },
  (t) => [index("credit_repayment_contract_idx").on(t.contractId)],
);

// ── Trust: explainable readiness ────────────────────────────────────────────

export const trustEvaluations = pgTable(
  "trust_evaluations",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    policyVersion: text("policy_version").notNull(),
    ring: integer("ring").notNull(),
    readiness: text("readiness").notNull(),
    signals: jsonb("signals").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("trust_eval_user_idx").on(t.userId, t.createdAt)],
);

export const passports = pgTable(
  "passports",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    code: text("code").notNull().unique(),
    audience: text("audience").notNull(),
    scope: jsonb("scope").$type<string[]>().notNull(),
    snapshot: jsonb("snapshot").notNull(),
    signature: text("signature").notNull(),
    views: integer("views").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [index("passports_user_idx").on(t.userId)],
);

// ── Devices, leasing, offline sync ──────────────────────────────────────────

export const deviceModels = pgTable("device_models", {
  id: id(),
  name: text("name").notNull(),
  priceCents: bigint("price_cents", { mode: "number" }).notNull(),
  specs: text("specs"),
  active: boolean("active").notNull().default(true),
});

export const devices = pgTable(
  "devices",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id),
    modelId: uuid("model_id").references(() => deviceModels.id),
    label: text("label").notNull(),
    serial: text("serial"),
    publicKey: text("public_key"),
    status: text("status").$type<"em_stock" | "activo" | "perdido" | "bloqueado" | "devolvido">().notNull().default("activo"),
    lastSyncAt: ts("last_sync_at"),
    lastSeq: bigint("last_seq", { mode: "number" }).notNull().default(0),
    lastHash: text("last_hash"),
    wipeRequestedAt: ts("wipe_requested_at"),
    createdAt: createdAt(),
  },
  (t) => [index("devices_user_idx").on(t.userId)],
);

export const deviceLeases = pgTable(
  "device_leases",
  {
    id: id(),
    code: text("code").notNull().unique(),
    deviceId: uuid("device_id").notNull().references(() => devices.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    agentId: uuid("agent_id").references(() => agents.id),
    status: text("status").$type<"activo" | "em_atraso" | "concluido" | "cancelado">().notNull().default("activo"),
    instalmentCents: bigint("instalment_cents", { mode: "number" }).notNull(),
    instalments: integer("instalments").notNull(),
    frequency: text("frequency").$type<"semanal" | "mensal">().notNull().default("semanal"),
    isExampleTerms: boolean("is_example_terms").notNull().default(true),
    startedAt: ts("started_at").notNull().defaultNow(),
  },
  (t) => [index("device_leases_user_idx").on(t.userId)],
);

export const leasePayments = pgTable(
  "lease_payments",
  {
    id: id(),
    leaseId: uuid("lease_id").notNull().references(() => deviceLeases.id),
    number: integer("number").notNull(),
    dueDate: date("due_date").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    status: text("status").$type<"por_pagar" | "pago" | "em_atraso">().notNull().default("por_pagar"),
    paidAt: ts("paid_at"),
    entryId: uuid("entry_id"),
  },
  (t) => [uniqueIndex("lease_payment_uq").on(t.leaseId, t.number)],
);

export type SyncOpStatus = "applied" | "duplicate" | "conflict" | "rejected";

export const syncOps = pgTable(
  "sync_ops",
  {
    opId: uuid("op_id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    deviceId: uuid("device_id").references(() => devices.id),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    deviceSeq: bigint("device_seq", { mode: "number" }),
    prevHash: text("prev_hash"),
    hash: text("hash"),
    signature: text("signature"),
    status: text("status").$type<SyncOpStatus>().notNull(),
    result: jsonb("result"),
    clientTime: ts("client_time"),
    receivedAt: ts("received_at").notNull().defaultNow(),
  },
  (t) => [index("sync_ops_user_idx").on(t.userId, t.receivedAt), index("sync_ops_status_idx").on(t.status)],
);

export const syncConflicts = pgTable(
  "sync_conflicts",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    opId: uuid("op_id").notNull(),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    status: text("status").$type<"aberto" | "resolvido">().notNull().default("aberto"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: ts("resolved_at"),
    resolution: text("resolution"),
    createdAt: createdAt(),
  },
  (t) => [index("sync_conflicts_status_idx").on(t.status)],
);

// ── Field operations ────────────────────────────────────────────────────────

export const visits = pgTable(
  "visits",
  {
    id: id(),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    businessId: uuid("business_id").notNull().references(() => businesses.id),
    purpose: text("purpose").notNull(),
    outcome: text("outcome").notNull(),
    note: text("note"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("visits_agent_idx").on(t.agentId, t.at)],
);

export type IncidentKind = "suporte" | "tecnico" | "fraude" | "documento" | "dispositivo" | "sync" | "reclamacao";

export const incidents = pgTable(
  "incidents",
  {
    id: id(),
    code: text("code").notNull().unique(),
    kind: text("kind").$type<IncidentKind>().notNull(),
    severity: text("severity").$type<"baixa" | "media" | "alta">().notNull().default("media"),
    status: text("status").$type<"aberto" | "em_curso" | "resolvido">().notNull().default("aberto"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    subjectUserId: uuid("subject_user_id").references(() => users.id),
    openedBy: uuid("opened_by").references(() => users.id),
    openedVia: text("opened_via").notNull().default("agente"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    resolution: text("resolution"),
    createdAt: createdAt(),
    resolvedAt: ts("resolved_at"),
  },
  (t) => [index("incidents_status_idx").on(t.status), index("incidents_subject_idx").on(t.subjectUserId)],
);

export const agentEarnings = pgTable(
  "agent_earnings",
  {
    id: id(),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    kind: text("kind").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    subjectUserId: uuid("subject_user_id").references(() => users.id),
    isExampleRate: boolean("is_example_rate").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("agent_earnings_idx").on(t.agentId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    channel: text("channel").$type<"inbox" | "whatsapp" | "sms">().notNull().default("inbox"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    status: text("status").$type<"pendente" | "enviada" | "falhou">().notNull().default("enviada"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id"),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id"),
    targetUserId: uuid("target_user_id"),
    data: jsonb("data"),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_action_idx").on(t.action),
    index("audit_target_idx").on(t.targetUserId),
    index("audit_at_idx").on(t.at),
  ],
);

// ── AI and channels ─────────────────────────────────────────────────────────

export const proposals = pgTable(
  "proposals",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    channel: text("channel").$type<Channel>().notNull(),
    sourceText: text("source_text").notNull(),
    intent: text("intent").notNull(),
    payload: jsonb("payload").notNull(),
    summary: text("summary").notNull(),
    status: text("status").$type<"pendente" | "confirmada" | "rejeitada" | "expirada">().notNull().default("pendente"),
    opId: uuid("op_id"),
    expiresAt: ts("expires_at").notNull(),
    decidedAt: ts("decided_at"),
    createdAt: createdAt(),
  },
  (t) => [index("proposals_user_idx").on(t.userId, t.status)],
);

export const aiTurns = pgTable(
  "ai_turns",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id),
    channel: text("channel").notNull(),
    input: text("input").notNull(),
    intent: text("intent").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    engine: text("engine").$type<"regras" | "claude">().notNull(),
    response: text("response").notNull(),
    escalated: boolean("escalated").notNull().default(false),
    sources: jsonb("sources").$type<string[]>(),
    guardrails: jsonb("guardrails").$type<string[]>(),
    latencyMs: integer("latency_ms"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_turns_time_idx").on(t.createdAt), index("ai_turns_user_idx").on(t.userId)],
);

export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: id(),
    direction: text("direction").$type<"entrada" | "saida">().notNull(),
    phone: text("phone").notNull(),
    userId: uuid("user_id").references(() => users.id),
    body: text("body").notNull(),
    providerId: text("provider_id"),
    status: text("status").notNull().default("registada"),
    simulated: boolean("simulated").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("wa_phone_idx").on(t.phone, t.createdAt),
    uniqueIndex("wa_provider_uq").on(t.providerId).where(sql`${t.providerId} is not null`),
  ],
);

export const kbDocuments = pgTable("kb_documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  domain: text("domain").notNull(),
  version: text("version").notNull(),
  status: text("status").$type<"draft" | "approved">().notNull().default("draft"),
  source: text("source").notNull(),
  authority: text("authority").notNull(),
  effectiveDate: date("effective_date"),
  reviewDate: date("review_date"),
  language: text("language").notNull().default("pt-MZ"),
  sensitivity: text("sensitivity").$type<"public" | "internal" | "confidential">().notNull().default("internal"),
  entities: jsonb("entities").$type<string[]>().notNull(),
  keywords: jsonb("keywords").$type<string[]>().notNull(),
  body: text("body").notNull(),
  approvedBy: uuid("approved_by").references(() => users.id),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const kbChunks = pgTable(
  "kb_chunks",
  {
    id: id(),
    documentId: text("document_id").notNull().references(() => kbDocuments.id, { onDelete: "cascade" }),
    section: text("section").notNull(),
    ordinal: integer("ordinal").notNull(),
    content: text("content").notNull(),
  },
  (t) => [index("kb_chunks_doc_idx").on(t.documentId)],
);

// ── Risk ────────────────────────────────────────────────────────────────────

export type AlertSeverity = "baixa" | "media" | "alta" | "critica";

export const riskCases = pgTable(
  "risk_cases",
  {
    id: id(),
    code: text("code").notNull().unique(),
    title: text("title").notNull(),
    kind: text("kind").$type<"credito" | "fraude" | "conduta" | "dados">().notNull(),
    severity: text("severity").$type<AlertSeverity>().notNull(),
    status: text("status").$type<"aberto" | "em_investigacao" | "fechado">().notNull().default("aberto"),
    ownerId: uuid("owner_id").references(() => users.id),
    subjectUserId: uuid("subject_user_id").references(() => users.id),
    summary: text("summary").notNull(),
    conclusion: text("conclusion"),
    createdAt: createdAt(),
    closedAt: ts("closed_at"),
  },
  (t) => [index("risk_cases_status_idx").on(t.status)],
);

export const riskCaseNotes = pgTable(
  "risk_case_notes",
  {
    id: id(),
    caseId: uuid("case_id").notNull().references(() => riskCases.id),
    actorId: uuid("actor_id").notNull().references(() => users.id),
    note: text("note").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("risk_case_notes_idx").on(t.caseId)],
);

export const riskAlerts = pgTable(
  "risk_alerts",
  {
    id: id(),
    rule: text("rule").notNull(),
    severity: text("severity").$type<AlertSeverity>().notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    subjectUserId: uuid("subject_user_id").references(() => users.id),
    marketId: uuid("market_id").references(() => markets.id),
    evidence: jsonb("evidence"),
    status: text("status").$type<"aberto" | "em_revisao" | "fechado">().notNull().default("aberto"),
    caseId: uuid("case_id").references(() => riskCases.id),
    dedupeKey: text("dedupe_key").notNull().unique(),
    closedBy: uuid("closed_by").references(() => users.id),
    closureNote: text("closure_note"),
    createdAt: createdAt(),
    closedAt: ts("closed_at"),
  },
  (t) => [index("risk_alerts_status_idx").on(t.status, t.severity)],
);

// ── Programme governance ────────────────────────────────────────────────────

export const readinessItems = pgTable("readiness_items", {
  id: id(),
  position: integer("position").notNull(),
  area: text("area").notNull(),
  title: text("title").notNull(),
  status: text("status").$type<"por_iniciar" | "em_curso" | "validado" | "bloqueado">().notNull().default("por_iniciar"),
  owner: text("owner"),
  note: text("note"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
});

export const leads = pgTable(
  "leads",
  {
    id: id(),
    kind: text("kind").$type<"comerciante" | "agente" | "fornecedor" | "parceiro" | "investidor">().notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    organisation: text("organisation"),
    market: text("market"),
    message: text("message"),
    status: text("status").$type<"novo" | "contactado" | "fechado">().notNull().default("novo"),
    createdAt: createdAt(),
  },
  (t) => [index("leads_status_idx").on(t.status, t.createdAt)],
);

// Composite key kept out of the main list above for readability.
export const readReceipts = pgTable(
  "read_receipts",
  {
    userId: uuid("user_id").notNull(),
    key: text("key").notNull(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);
