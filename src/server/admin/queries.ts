import "server-only";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { addDays, daysAgo, maputoDay } from "@/lib/dates";
import { rowsOf, type Executor } from "../db/client";
import {
  accessLog,
  agents,
  aiTurns,
  auditEvents,
  businesses,
  consents,
  creditApplications,
  creditContracts,
  creditDecisions,
  devices,
  deviceLeases,
  documents,
  incidents,
  journalEntries,
  kycAttestations,
  kycEvents,
  kycProfiles,
  markets,
  riskAlerts,
  suppliers,
  syncConflicts,
  users,
} from "../db/schema";
import { trustFor } from "../trust/facts";

export async function consoleCounts(db: Executor) {
  const [row] = rowsOf<Record<string, string>>(
    await db.execute(sql`
      select
        (select count(*) from ukuphila.documents where status in ('submetido','em_revisao')) as kyc,
        (select count(*) from ukuphila.credit_applications where status in ('submetido','em_analise','recomendado')) as credit,
        (select count(*) from ukuphila.incidents where status <> 'resolvido') as incidents,
        (select count(*) from ukuphila.sync_conflicts where status = 'aberto') as conflicts,
        (select count(*) from ukuphila.risk_alerts where status <> 'fechado') as alerts,
        (select count(*) from ukuphila.leads where status = 'novo') as leads
    `),
  );
  return { kyc: Number(row.kyc), credit: Number(row.credit), incidents: Number(row.incidents), conflicts: Number(row.conflicts), alerts: Number(row.alerts), leads: Number(row.leads) };
}

export async function listMerchants(db: Executor, filters: { q?: string; market?: string; ring?: string }) {
  const search = filters.q?.trim();
  const rows = rowsOf<{ id: string; name: string; phone: string; status: string; business: string; market: string; agent: string | null; level: number; ring: number | null; readiness: string | null; last_at: string | null; entries30: string }>(
    await db.execute(sql`
      select u.id, u.display_name as name, u.phone, u.status, b.name as business, m.name as market, au.display_name as agent, coalesce(k.level, 0) as level,
        (select t.ring from ukuphila.trust_evaluations t where t.user_id = u.id order by t.created_at desc limit 1) as ring,
        (select t.readiness from ukuphila.trust_evaluations t where t.user_id = u.id order by t.created_at desc limit 1) as readiness,
        (select max(e.occurred_at) from ukuphila.journal_entries e where e.user_id = u.id) as last_at,
        (select count(*) from ukuphila.journal_entries e where e.user_id = u.id and e.occurred_at >= ${daysAgo(30).toISOString()}::timestamptz) as entries30
      from ukuphila.users u
      join ukuphila.businesses b on b.owner_id = u.id
      join ukuphila.markets m on m.id = b.market_id
      left join ukuphila.agents a on a.id = b.agent_id
      left join ukuphila.users au on au.id = a.user_id
      left join ukuphila.kyc_profiles k on k.user_id = u.id
      where u.role = 'merchant'
        ${search ? sql`and (u.display_name ilike ${`%${search}%`} or b.name ilike ${`%${search}%`})` : sql``}
        ${filters.market ? sql`and m.slug = ${filters.market}` : sql``}
      order by last_at desc nulls last
      limit 120
    `),
  );
  const merchants = rows.map((row) => ({ id: row.id, name: row.name, phone: row.phone, status: row.status, businessName: row.business, market: row.market, agent: row.agent, level: Number(row.level), ring: row.ring ? Number(row.ring) : null, readiness: row.readiness, lastAt: row.last_at, entries30: Number(row.entries30) }));
  return filters.ring ? merchants.filter((row) => String(row.ring) === filters.ring) : merchants;
}

export async function merchantDossier(db: Executor, userId: string) {
  const [profile] = await db
    .select({ user: users, business: businesses, market: markets, kyc: kycProfiles })
    .from(users)
    .innerJoin(businesses, eq(businesses.ownerId, users.id))
    .innerJoin(markets, eq(markets.id, businesses.marketId))
    .leftJoin(kycProfiles, eq(kycProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!profile) return null;
  const [trust, recent, docs, consentRows, attestationRows, kycHistory, contracts, applications, incidentRows, conflicts, viewers, agentRow, balances] = await Promise.all([
    trustFor(db, userId),
    db.select().from(journalEntries).where(eq(journalEntries.userId, userId)).orderBy(desc(journalEntries.occurredAt)).limit(14),
    db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt)),
    db.select().from(consents).where(eq(consents.userId, userId)),
    db.select().from(kycAttestations).where(eq(kycAttestations.userId, userId)).orderBy(desc(kycAttestations.createdAt)),
    db.select().from(kycEvents).where(eq(kycEvents.userId, userId)).orderBy(desc(kycEvents.createdAt)).limit(6),
    db.select({ contract: creditContracts, supplierName: suppliers.name }).from(creditContracts).innerJoin(suppliers, eq(suppliers.id, creditContracts.supplierId)).where(eq(creditContracts.userId, userId)).orderBy(desc(creditContracts.createdAt)),
    db.select().from(creditApplications).where(eq(creditApplications.userId, userId)).orderBy(desc(creditApplications.createdAt)).limit(5),
    db.select().from(incidents).where(eq(incidents.subjectUserId, userId)).orderBy(desc(incidents.createdAt)).limit(6),
    db.select().from(syncConflicts).where(and(eq(syncConflicts.userId, userId), eq(syncConflicts.status, "aberto"))),
    db.select({ log: accessLog, name: users.displayName }).from(accessLog).innerJoin(users, eq(users.id, accessLog.actorId)).where(eq(accessLog.subjectId, userId)).orderBy(desc(accessLog.at)).limit(8),
    profile.business.agentId ? db.select({ name: users.displayName, code: agents.code }).from(agents).innerJoin(users, eq(users.id, agents.userId)).where(eq(agents.id, profile.business.agentId)).limit(1) : Promise.resolve([]),
    db.execute(sql`select a.code, coalesce(sum(p.amount_cents), 0) as balance from ukuphila.accounts a left join ukuphila.postings p on p.account_id = a.id where a.user_id = ${userId} group by a.code`),
  ]);
  const balanceRows = rowsOf<{ code: string; balance: string }>(balances);
  return {
    ...profile,
    trust,
    recent,
    documents: docs,
    consents: consentRows,
    attestations: attestationRows,
    kycHistory,
    contracts,
    applications,
    incidents: incidentRows,
    conflicts,
    viewers,
    agent: agentRow[0] ?? null,
    balance: (code: string) => Number(balanceRows.find((row) => row.code === code)?.balance ?? 0),
  };
}

export async function listDocuments(db: Executor, status: "fila" | "decididos") {
  const statuses = status === "fila" ? (["submetido", "em_revisao"] as const) : (["aprovado", "rejeitado"] as const);
  return db
    .select({ document: documents, name: users.displayName, market: markets.name })
    .from(documents)
    .innerJoin(users, eq(users.id, documents.userId))
    .innerJoin(businesses, eq(businesses.ownerId, documents.userId))
    .innerJoin(markets, eq(markets.id, businesses.marketId))
    .where(inArray(documents.status, [...statuses]))
    .orderBy(status === "fila" ? documents.submittedAt : desc(documents.reviewedAt))
    .limit(60);
}

export async function documentDetail(db: Executor, id: string) {
  const [row] = await db.select({ document: documents, name: users.displayName, userId: users.id }).from(documents).innerJoin(users, eq(users.id, documents.userId)).where(eq(documents.id, id)).limit(1);
  return row ?? null;
}

export async function listApplications(db: Executor) {
  return db
    .select({ application: creditApplications, name: users.displayName, supplierName: suppliers.name, market: markets.name })
    .from(creditApplications)
    .innerJoin(users, eq(users.id, creditApplications.userId))
    .innerJoin(suppliers, eq(suppliers.id, creditApplications.supplierId))
    .innerJoin(businesses, eq(businesses.ownerId, creditApplications.userId))
    .innerJoin(markets, eq(markets.id, businesses.marketId))
    .orderBy(desc(creditApplications.createdAt))
    .limit(80);
}

export async function applicationDetail(db: Executor, id: string) {
  const [row] = await db
    .select({ application: creditApplications, name: users.displayName, supplierName: suppliers.name })
    .from(creditApplications)
    .innerJoin(users, eq(users.id, creditApplications.userId))
    .innerJoin(suppliers, eq(suppliers.id, creditApplications.supplierId))
    .where(eq(creditApplications.id, id))
    .limit(1);
  if (!row) return null;
  const [decisions, trust] = await Promise.all([
    db.select({ decision: creditDecisions, name: users.displayName }).from(creditDecisions).innerJoin(users, eq(users.id, creditDecisions.actorId)).where(eq(creditDecisions.applicationId, id)).orderBy(creditDecisions.createdAt),
    trustFor(db, row.application.userId),
  ]);
  return { ...row, decisions, trust };
}

export async function listEntries(db: Executor, filters: { kind?: string; channel?: string }) {
  const conditions = [filters.kind ? eq(journalEntries.kind, filters.kind as never) : undefined, filters.channel ? eq(journalEntries.channel, filters.channel as never) : undefined].filter(Boolean);
  return db
    .select({ entry: journalEntries, name: users.displayName })
    .from(journalEntries)
    .innerJoin(users, eq(users.id, journalEntries.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(journalEntries.recordedAt))
    .limit(80);
}

export async function listIncidents(db: Executor) {
  return db.select({ incident: incidents, name: users.displayName }).from(incidents).leftJoin(users, eq(users.id, incidents.subjectUserId)).orderBy(desc(incidents.createdAt)).limit(60);
}

export async function listConflicts(db: Executor) {
  return db.select({ conflict: syncConflicts, name: users.displayName }).from(syncConflicts).innerJoin(users, eq(users.id, syncConflicts.userId)).where(eq(syncConflicts.status, "aberto")).orderBy(desc(syncConflicts.createdAt)).limit(40);
}

export async function listDevices(db: Executor) {
  const rows = await db
    .select({ device: devices, lease: deviceLeases, name: users.displayName })
    .from(devices)
    .leftJoin(deviceLeases, eq(deviceLeases.deviceId, devices.id))
    .leftJoin(users, eq(users.id, devices.userId))
    .orderBy(desc(devices.createdAt))
    .limit(80);
  const late = rowsOf<{ lease_id: string; late: string; paid: string; total: string }>(
    await db.execute(sql`
      select lease_id, count(*) filter (where status = 'em_atraso') as late, count(*) filter (where status = 'pago') as paid, count(*) as total
      from ukuphila.lease_payments group by lease_id
    `),
  );
  return rows.map((row) => {
    const stats = late.find((item) => item.lease_id === row.lease?.id);
    return { ...row, late: Number(stats?.late ?? 0), paid: Number(stats?.paid ?? 0), total: Number(stats?.total ?? 0) };
  });
}

export async function listAiTurns(db: Executor, limit = 40) {
  return db.select({ turn: aiTurns, name: users.displayName }).from(aiTurns).leftJoin(users, eq(users.id, aiTurns.userId)).orderBy(desc(aiTurns.createdAt)).limit(limit);
}

export async function aiIntentStats(db: Executor) {
  const rows = await db.select({ intent: aiTurns.intent, total: sql<string>`count(*)` }).from(aiTurns).groupBy(aiTurns.intent).orderBy(sql`count(*) desc`).limit(10);
  return rows.map((row) => ({ intent: row.intent, total: Number(row.total) }));
}

export async function listAudit(db: Executor, filters: { action?: string }) {
  return db
    .select({ event: auditEvents, actor: users.displayName })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(filters.action ? ilike(auditEvents.action, `%${filters.action}%`) : undefined)
    .orderBy(desc(auditEvents.seq))
    .limit(100);
}

export async function listAlerts(db: Executor, open = true) {
  return db
    .select({ alert: riskAlerts, name: users.displayName })
    .from(riskAlerts)
    .leftJoin(users, eq(users.id, riskAlerts.subjectUserId))
    .where(open ? or(eq(riskAlerts.status, "aberto"), eq(riskAlerts.status, "em_revisao")) : eq(riskAlerts.status, "fechado"))
    .orderBy(desc(riskAlerts.createdAt))
    .limit(80);
}

/** Readiness by group. A large gap is a question to investigate, not proof of bias. */
export async function fairnessView(db: Executor) {
  const rows = rowsOf<{ grp: string; dimension: string; total: string; ready: string }>(
    await db.execute(sql`
      with latest as (select distinct on (user_id) user_id, ring from ukuphila.trust_evaluations order by user_id, created_at desc)
      select m.name as grp, 'Mercado' as dimension, count(*) as total, count(*) filter (where l.ring = 4) as ready
      from latest l join ukuphila.businesses b on b.owner_id = l.user_id join ukuphila.markets m on m.id = b.market_id group by m.name
      union all
      select b.activity as grp, 'Actividade' as dimension, count(*) as total, count(*) filter (where l.ring = 4) as ready
      from latest l join ukuphila.businesses b on b.owner_id = l.user_id group by b.activity
    `),
  );
  return rows.map((row) => ({ group: row.grp, dimension: row.dimension, total: Number(row.total), ready: Number(row.ready), rate: Number(row.total) ? Number(row.ready) / Number(row.total) : 0 }));
}

export async function recentlyDueContracts(db: Executor) {
  return rowsOf<{ code: string; name: string; due: string; amount: string }>(
    await db.execute(sql`
      select c.code, u.display_name as name, i.due_date::text as due, (i.amount_cents - i.paid_cents) as amount
      from ukuphila.credit_instalments i join ukuphila.credit_contracts c on c.id = i.contract_id join ukuphila.users u on u.id = c.user_id
      where i.status in ('por_pagar','parcial') and i.due_date between ${maputoDay()}::date and ${addDays(maputoDay(), 7)}::date
      order by i.due_date limit 8
    `),
  );
}
