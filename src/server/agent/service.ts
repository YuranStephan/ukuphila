import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { addDays, daysAgo, maputoDay } from "@/lib/dates";
import { normalizePhone } from "@/lib/phone";
import { recordAudit } from "../audit";
import type { SessionUser } from "../auth/session";
import { createMerchant } from "../auth/service";
import { randomCode } from "../crypto";
import { rowsOf, type Db, type Executor, type Tx } from "../db/client";
import {
  accessLog,
  agentEarnings,
  agents,
  businesses,
  consents,
  deviceLeases,
  devices,
  incidents,
  leasePayments,
  markets,
  sessions,
  users,
  visits,
  type IncidentKind,
} from "../db/schema";
import { DomainError } from "../errors";
import { getSetting } from "../settings";
import { executeOp, type OpOutcome } from "../sync/execute";
import type { OpType } from "../sync/schemas";
import { notify } from "../notifications";

export async function agentProfile(db: Executor, userId: string) {
  const [agent] = await db
    .select({ id: agents.id, code: agents.code, marketId: agents.marketId, marketName: markets.name, kioskName: agents.kioskName, status: agents.status })
    .from(agents)
    .innerJoin(markets, eq(markets.id, agents.marketId))
    .where(eq(agents.userId, userId))
    .limit(1);
  if (!agent) throw new DomainError("agente", "Esta conta não tem perfil de agente.");
  return agent;
}

/** An agent only reaches their own merchants, and each look at someone's data is recorded for that person to see. */
export async function assertAssigned(db: Executor, agentId: string, merchantId: string) {
  const [business] = await db.select({ agentId: businesses.agentId }).from(businesses).where(eq(businesses.ownerId, merchantId)).limit(1);
  if (!business || business.agentId !== agentId) throw new DomainError("sem_permissao", "Este comerciante não está na tua carteira.");
}

export async function logAgentView(db: Executor, agentUser: SessionUser, merchantId: string, resource: string) {
  await db.insert(accessLog).values({ subjectId: merchantId, actorId: agentUser.id, actorRole: agentUser.role, purpose: "Apoio do agente", resource });
}

export type RondaItem = { merchantId: string; name: string; businessName: string; stall: string | null; reason: string; detail: string; priority: 1 | 2 | 3 };

/** The agent's day: who to see first, and why. Rebuilt from live data, so a solved problem drops off by itself. */
export async function buildRonda(db: Executor, agentId: string): Promise<RondaItem[]> {
  const rows = rowsOf<{
    id: string;
    name: string;
    business: string;
    stall: string | null;
    status: string;
    level: number;
    onboarded: string | null;
    last_at: string | null;
    rejected: string;
    pending_docs: string;
    conflicts: string;
    late_credit: string;
    open_incidents: string;
    late_lease: string;
  }>(
    await db.execute(sql`
      select u.id, u.display_name as name, b.name as business, b.stall, u.status, coalesce(k.level, 0) as level, b.onboarded_at as onboarded,
        (select max(e.occurred_at) from journal_entries e where e.user_id = u.id) as last_at,
        (select count(*) from documents d where d.user_id = u.id and d.status = 'rejeitado'
          and not exists (select 1 from documents n where n.supersedes_id = d.id)) as rejected,
        (select count(*) from documents d where d.user_id = u.id and d.status in ('submetido','em_revisao')) as pending_docs,
        (select count(*) from sync_conflicts c where c.user_id = u.id and c.status = 'aberto') as conflicts,
        (select count(*) from credit_contracts c where c.user_id = u.id and c.status in ('em_atraso','incumprimento')) as late_credit,
        (select count(*) from incidents i where i.subject_user_id = u.id and i.status <> 'resolvido') as open_incidents,
        (select count(*) from lease_payments p join device_leases l on l.id = p.lease_id where l.user_id = u.id and p.status = 'em_atraso') as late_lease
      from businesses b join users u on u.id = b.owner_id left join kyc_profiles k on k.user_id = u.id
      where b.agent_id = ${agentId}
    `),
  );
  const silentBefore = daysAgo(5).getTime();
  const items: RondaItem[] = [];
  for (const row of rows) {
    const base = { merchantId: row.id, name: row.name, businessName: row.business, stall: row.stall };
    if (Number(row.open_incidents) > 0) items.push({ ...base, reason: "Pedido de ajuda", detail: "Tem um pedido por resolver.", priority: 1 });
    if (Number(row.late_credit) > 0) items.push({ ...base, reason: "Prestação em atraso", detail: "Conversa antes que o atraso cresça.", priority: 1 });
    if (Number(row.rejected) > 0) items.push({ ...base, reason: "Documento rejeitado", detail: "Explica a correcção e tira nova fotografia.", priority: 1 });
    if (Number(row.conflicts) > 0) items.push({ ...base, reason: "Registos por rever", detail: "Ajuda a confirmar o que ficou em dúvida.", priority: 2 });
    if (Number(row.late_lease) > 0) items.push({ ...base, reason: "Prestação do telefone", detail: "Há uma prestação em atraso.", priority: 2 });
    if (!row.onboarded) items.push({ ...base, reason: "Acabar o registo", detail: "O onboarding ainda não terminou.", priority: 2 });
    if (Number(row.level) === 0) items.push({ ...base, reason: "Verificação inicial", detail: "Confirma o rosto para chegar ao nível 1.", priority: 2 });
    if (row.last_at && new Date(row.last_at).getTime() < silentBefore) items.push({ ...base, reason: "Sem registos há dias", detail: "Passa pela banca e vê se precisa de ajuda.", priority: 3 });
  }
  return items.sort((a, b) => a.priority - b.priority).slice(0, 40);
}

export async function agentPortfolio(db: Executor, agentId: string) {
  const rows = rowsOf<{ id: string; name: string; business: string; stall: string | null; activity: string; level: number; status: string; last_at: string | null; entries30: string }>(
    await db.execute(sql`
      select u.id, u.display_name as name, b.name as business, b.stall, b.activity, coalesce(k.level, 0) as level, u.status,
        (select max(e.occurred_at) from journal_entries e where e.user_id = u.id) as last_at,
        (select count(*) from journal_entries e where e.user_id = u.id and e.occurred_at >= ${daysAgo(30).toISOString()}::timestamptz) as entries30
      from businesses b join users u on u.id = b.owner_id left join kyc_profiles k on k.user_id = u.id
      where b.agent_id = ${agentId} order by u.display_name
    `),
  );
  return rows.map((row) => ({ id: row.id, name: row.name, businessName: row.business, stall: row.stall, activity: row.activity, level: Number(row.level), status: row.status, lastAt: row.last_at, entries30: Number(row.entries30) }));
}

export const ONBOARDING_STEPS = [
  "Apresentar o Ukuphila",
  "Consentimento",
  "Criar perfil",
  "Verificação aplicável",
  "Registar o negócio",
  "Configurar bolsos",
  "Primeiro registo",
  "Consultar saldo e histórico",
  "Explicar o apoio",
  "Concluir",
] as const;

export async function onboardMerchant(
  db: Db,
  agentUser: SessionUser,
  input: { phone: string; displayName: string; businessName: string; activity: string; category: string; stall?: string | null; consentOptional: string[] },
) {
  const agent = await agentProfile(db, agentUser.id);
  const phone = normalizePhone(input.phone);
  if (!phone) throw new DomainError("telefone", "Esse número não parece um telemóvel de Moçambique.");
  const rates = await getSetting(db, "agentRates");
  const merchant = await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const created = await createMerchant(
      tx,
      { phone, displayName: input.displayName, businessName: input.businessName, marketId: agent.marketId, activity: input.activity, category: input.category, stall: input.stall, agentId: agent.id, status: "activo" },
      { id: agentUser.id, role: agentUser.role },
    );
    const required = ["servico_base", "verificacao"];
    await tx.insert(consents).values(
      [...required, ...input.consentOptional].map((purpose) => ({ userId: created.id, purpose, policyVersion: "2026.11", channel: "agente", capturedBy: agentUser.id })),
    );
    await tx.update(businesses).set({ onboardingStep: 5 }).where(eq(businesses.ownerId, created.id));
    await tx.insert(agentEarnings).values({ agentId: agent.id, kind: "registo", amountCents: rates.onboardingCents, subjectUserId: created.id });
    return created;
  });
  return merchant;
}

export async function setOnboardingStep(db: Db, agentUser: SessionUser, merchantId: string, step: number) {
  const agent = await agentProfile(db, agentUser.id);
  await assertAssigned(db, agent.id, merchantId);
  const finished = step >= ONBOARDING_STEPS.length;
  await db
    .update(businesses)
    .set({ onboardingStep: Math.min(step, ONBOARDING_STEPS.length), onboardedAt: finished ? new Date() : null })
    .where(eq(businesses.ownerId, merchantId));
}

/** Help with a record: the entry carries the agent's identity and channel `agente`, so it can never pass as the merchant's own. */
export async function recordOnBehalf(db: Db, agentUser: SessionUser, merchantId: string, type: OpType, payload: unknown): Promise<OpOutcome> {
  const agent = await agentProfile(db, agentUser.id);
  await assertAssigned(db, agent.id, merchantId);
  return db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const opId = randomUUID();
    const outcome = await executeOp(tx, { userId: merchantId, actorId: agentUser.id, channel: "agente", opId, occurredAt: new Date() }, type, payload);
    await recordAudit(tx, { actorId: agentUser.id, actorRole: agentUser.role, action: "agente.registo_assistido", subjectType: "op", subjectId: opId, targetUserId: merchantId, data: { type } });
    await notify(tx, merchantId, { title: "O teu agente fez um registo por ti", body: "Confere em Movimentos. Se não estiver certo, avisa.", link: "/app/movimentos" });
    return outcome;
  });
}

export async function logVisit(db: Db, agentUser: SessionUser, input: { merchantId: string; purpose: string; outcome: string; note?: string | null }) {
  const agent = await agentProfile(db, agentUser.id);
  await assertAssigned(db, agent.id, input.merchantId);
  const [business] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, input.merchantId)).limit(1);
  await db.insert(visits).values({ agentId: agent.id, businessId: business.id, purpose: input.purpose, outcome: input.outcome, note: input.note ?? null });
}

export async function openIncident(db: Db, actor: { id: string; role: string }, input: { kind: IncidentKind; severity?: "baixa" | "media" | "alta"; title: string; description: string; subjectUserId?: string | null; via?: string }) {
  const code = `INC-${randomCode(5)}`;
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    await tx.insert(incidents).values({ code, kind: input.kind, severity: input.severity ?? "media", title: input.title, description: input.description, subjectUserId: input.subjectUserId ?? null, openedBy: actor.id, openedVia: input.via ?? "agente" });
    await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "incidente.aberto", subjectType: "incident", subjectId: code, targetUserId: input.subjectUserId ?? null, data: { kind: input.kind } });
  });
  return code;
}

export async function resolveIncident(db: Db, actor: { id: string; role: string }, incidentId: string, resolution: string) {
  if (resolution.trim().length < 5) throw new DomainError("incidente", "Escreve como ficou resolvido.");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const rows = await tx.update(incidents).set({ status: "resolvido", resolution, resolvedAt: new Date(), assignedTo: actor.id }).where(eq(incidents.id, incidentId)).returning({ code: incidents.code, subject: incidents.subjectUserId });
    if (rows.length === 0) throw new DomainError("incidente", "Incidente não encontrado.");
    await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "incidente.resolvido", subjectType: "incident", subjectId: rows[0].code, targetUserId: rows[0].subject });
  });
}

/** Lost phone: sessions end now, the device is blocked, and the local copy is wiped the next time it reaches the network. */
export async function reportDeviceLost(db: Db, actor: { id: string; role: string }, deviceId: string) {
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [device] = await tx.update(devices).set({ status: "perdido", wipeRequestedAt: new Date() }).where(eq(devices.id, deviceId)).returning();
    if (!device) throw new DomainError("dispositivo", "Dispositivo não encontrado.");
    if (device.userId) await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, device.userId), eq(sessions.deviceId, deviceId)));
    await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "dispositivo.perdido", subjectType: "device", subjectId: deviceId, targetUserId: device.userId });
  });
}

export async function createLease(db: Db, agentUser: SessionUser, input: { merchantId: string; modelId: string; instalmentCents: number; instalments: number; serial?: string | null }) {
  const agent = await agentProfile(db, agentUser.id);
  await assertAssigned(db, agent.id, input.merchantId);
  return db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [device] = await tx.insert(devices).values({ userId: input.merchantId, modelId: input.modelId, label: "Telefone Ukuphila", serial: input.serial ?? null, status: "activo" }).returning();
    const [lease] = await tx.insert(deviceLeases).values({ code: `LS-${randomCode(6)}`, deviceId: device.id, userId: input.merchantId, agentId: agent.id, instalmentCents: input.instalmentCents, instalments: input.instalments }).returning();
    const today = maputoDay();
    await tx.insert(leasePayments).values(Array.from({ length: input.instalments }, (_, index) => ({ leaseId: lease.id, number: index + 1, dueDate: addDays(today, (index + 1) * 7), amountCents: input.instalmentCents })));
    await recordAudit(tx, { actorId: agentUser.id, actorRole: agentUser.role, action: "leasing.criado", subjectType: "lease", subjectId: lease.id, targetUserId: input.merchantId });
    return lease;
  });
}

export async function agentIncidents(db: Executor, agentId: string) {
  return db
    .select({ incident: incidents, subjectName: users.displayName })
    .from(incidents)
    .innerJoin(businesses, eq(businesses.ownerId, incidents.subjectUserId))
    .innerJoin(users, eq(users.id, incidents.subjectUserId))
    .where(and(eq(businesses.agentId, agentId), inArray(incidents.status, ["aberto", "em_curso"])))
    .orderBy(desc(incidents.createdAt));
}
