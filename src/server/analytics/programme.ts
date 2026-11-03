import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { addDays, daysAgo, maputoDay } from "@/lib/dates";
import { rowsOf, type Executor } from "../db/client";
import { creditApplications, creditContracts, incidents, kycProfiles, markets, riskAlerts, riskCases, suppliers, syncOps } from "../db/schema";

/** KPIs of KB §39, always computed from operational tables. No figure on a dashboard is stored by hand. */
export async function programmeKpis(db: Executor) {
  const now = new Date();
  const [merchants, activity, savings, xitique, operations, sync, ai] = await Promise.all([
    db.execute(sql`
      select count(*) as total,
        count(*) filter (where u.created_at >= ${daysAgo(30, now).toISOString()}::timestamptz) as new30,
        count(*) filter (where u.status = 'preliminar') as preliminar,
        count(*) filter (where b.onboarded_at is not null) as onboarded
      from ukuphila.users u join ukuphila.businesses b on b.owner_id = u.id where u.role = 'merchant'
    `),
    db.execute(sql`
      select
        count(distinct user_id) filter (where occurred_at >= ${daysAgo(7, now).toISOString()}::timestamptz) as wau,
        count(distinct user_id) filter (where occurred_at >= ${daysAgo(30, now).toISOString()}::timestamptz) as mau,
        count(distinct user_id) as ever,
        count(*) filter (where occurred_at >= ${daysAgo(30, now).toISOString()}::timestamptz) as entries30,
        count(distinct user_id) filter (where kind = 'transferencia' and category = 'retirada_casa' and occurred_at >= ${daysAgo(30, now).toISOString()}::timestamptz) as separating,
        coalesce(sum(amount_cents) filter (where kind in ('venda','venda_fiado') and occurred_at >= ${daysAgo(30, now).toISOString()}::timestamptz), 0) as sales30,
        count(*) filter (where channel = 'voz' and occurred_at >= ${daysAgo(30, now).toISOString()}::timestamptz) as voice30,
        count(*) filter (where channel = 'whatsapp' and occurred_at >= ${daysAgo(30, now).toISOString()}::timestamptz) as whatsapp30,
        count(*) filter (where channel = 'agente' and occurred_at >= ${daysAgo(30, now).toISOString()}::timestamptz) as agent30
      from ukuphila.journal_entries where kind <> 'estorno'
    `),
    db.execute(sql`
      select count(distinct user_id) filter (where kind = 'poupanca_deposito' and occurred_at >= ${daysAgo(60, now).toISOString()}::timestamptz) as savers
      from ukuphila.journal_entries
    `),
    db.execute(sql`
      select
        (select count(*) from ukuphila.xitique_groups where status = 'activo') as groups,
        (select count(distinct user_id) from ukuphila.xitique_members where user_id is not null) as members,
        coalesce((select sum(amount_cents) from ukuphila.xitique_contributions where status = 'confirmada'), 0) as contributed,
        (select count(*) from ukuphila.xitique_contributions where status = 'confirmada' and late_days = 0) as on_time,
        (select count(*) from ukuphila.xitique_contributions where status in ('confirmada','atrasada')) as due
    `),
    db.execute(sql`
      select
        (select count(*) from ukuphila.documents where status in ('submetido','em_revisao')) as kyc_queue,
        (select count(*) from ukuphila.incidents where status <> 'resolvido') as open_incidents,
        (select coalesce(avg(extract(epoch from reviewed_at - submitted_at)) / 3600, 0) from ukuphila.documents where reviewed_at is not null) as kyc_hours
    `),
    db.execute(sql`
      select count(*) as total,
        count(*) filter (where status = 'conflict') as conflicts,
        count(*) filter (where status = 'rejected') as rejected
      from ukuphila.sync_ops where received_at >= ${daysAgo(30, now).toISOString()}::timestamptz
    `),
    db.execute(sql`
      select count(*) as turns, count(*) filter (where escalated) as escalated, count(*) filter (where intent = 'UNKNOWN') as unknown
      from ukuphila.ai_turns where created_at >= ${daysAgo(30, now).toISOString()}::timestamptz
    `),
  ]);
  const m = rowsOf<Record<string, string>>(merchants)[0];
  const a = rowsOf<Record<string, string>>(activity)[0];
  const s = rowsOf<Record<string, string>>(savings)[0];
  const x = rowsOf<Record<string, string>>(xitique)[0];
  const o = rowsOf<Record<string, string>>(operations)[0];
  const y = rowsOf<Record<string, string>>(sync)[0];
  const i = rowsOf<Record<string, string>>(ai)[0];
  const n = (value: string | undefined) => Number(value ?? 0);
  return {
    merchants: n(m.total),
    newMerchants30: n(m.new30),
    preliminar: n(m.preliminar),
    activated: n(a.ever),
    wau: n(a.wau),
    mau: n(a.mau),
    entries30: n(a.entries30),
    salesRecorded30: n(a.sales30),
    separating: n(a.separating),
    channels30: { voz: n(a.voice30), whatsapp: n(a.whatsapp30), agente: n(a.agent30), app: Math.max(0, n(a.entries30) - n(a.voice30) - n(a.whatsapp30) - n(a.agent30)) },
    savers: n(s.savers),
    xitiqueGroups: n(x.groups),
    xitiqueMembers: n(x.members),
    xitiqueContributed: n(x.contributed),
    xitiqueOnTime: n(x.on_time),
    xitiqueDue: n(x.due),
    kycQueue: n(o.kyc_queue),
    kycHours: Math.round(n(o.kyc_hours) * 10) / 10,
    openIncidents: n(o.open_incidents),
    syncTotal: n(y.total),
    syncConflicts: n(y.conflicts),
    syncRejected: n(y.rejected),
    aiTurns: n(i.turns),
    aiEscalated: n(i.escalated),
    aiUnknown: n(i.unknown),
  };
}

export async function activitySeries(db: Executor, days = 60) {
  const since = addDays(maputoDay(), -days);
  const rows = rowsOf<{ day: string; entries: string; merchants: string; sales: string }>(
    await db.execute(sql`
      select (occurred_at at time zone 'Africa/Maputo')::date::text as day, count(*) as entries, count(distinct user_id) as merchants,
        coalesce(sum(amount_cents) filter (where kind in ('venda','venda_fiado')), 0) as sales
      from ukuphila.journal_entries where occurred_at >= ${since}::date and kind <> 'estorno'
      group by 1 order by 1
    `),
  );
  return rows.map((row) => ({ day: row.day, entries: Number(row.entries), merchants: Number(row.merchants), salesCents: Number(row.sales) }));
}

export async function ringFunnel(db: Executor) {
  const rows = rowsOf<{ ring: number; total: string }>(
    await db.execute(sql`
      select ring, count(*) as total from (
        select distinct on (user_id) user_id, ring from ukuphila.trust_evaluations order by user_id, created_at desc
      ) latest group by ring order by ring
    `),
  );
  return [1, 2, 3, 4].map((ring) => ({ ring, total: Number(rows.find((row) => Number(row.ring) === ring)?.total ?? 0) }));
}

export async function marketBreakdown(db: Executor) {
  const rows = rowsOf<{ id: string; name: string; stage: string; merchants: string; active: string; sales: string }>(
    await db.execute(sql`
      select m.id, m.name, m.stage, count(distinct b.owner_id) as merchants,
        count(distinct e.user_id) filter (where e.occurred_at >= ${daysAgo(7).toISOString()}::timestamptz) as active,
        coalesce(sum(e.amount_cents) filter (where e.kind in ('venda','venda_fiado') and e.occurred_at >= ${daysAgo(30).toISOString()}::timestamptz), 0) as sales
      from ukuphila.markets m
      left join ukuphila.businesses b on b.market_id = m.id
      left join ukuphila.journal_entries e on e.user_id = b.owner_id
      group by m.id order by merchants desc
    `),
  );
  return rows.map((row) => ({ id: row.id, name: row.name, stage: row.stage, merchants: Number(row.merchants), active: Number(row.active), salesCents: Number(row.sales) }));
}

export async function agentPerformance(db: Executor) {
  const rows = rowsOf<{ id: string; code: string; name: string; market: string; status: string; merchants: string; active: string; visits: string; open_incidents: string; earned: string }>(
    await db.execute(sql`
      select a.id, a.code, u.display_name as name, m.name as market, a.status,
        (select count(*) from ukuphila.businesses b where b.agent_id = a.id) as merchants,
        (select count(distinct e.user_id) from ukuphila.journal_entries e join ukuphila.businesses b on b.owner_id = e.user_id
          where b.agent_id = a.id and e.occurred_at >= ${daysAgo(7).toISOString()}::timestamptz) as active,
        (select count(*) from ukuphila.visits v where v.agent_id = a.id and v.at >= ${daysAgo(30).toISOString()}::timestamptz) as visits,
        (select count(*) from ukuphila.incidents i join ukuphila.businesses b on b.owner_id = i.subject_user_id where b.agent_id = a.id and i.status <> 'resolvido') as open_incidents,
        (select coalesce(sum(amount_cents), 0) from ukuphila.agent_earnings g where g.agent_id = a.id) as earned
      from ukuphila.agents a join ukuphila.users u on u.id = a.user_id join ukuphila.markets m on m.id = a.market_id
      order by merchants desc
    `),
  );
  return rows.map((row) => ({ id: row.id, code: row.code, name: row.name, market: row.market, status: row.status, merchants: Number(row.merchants), active: Number(row.active), visits: Number(row.visits), openIncidents: Number(row.open_incidents), earnedCents: Number(row.earned) }));
}

/** Portfolio view for the risk room. PAR counts the whole outstanding balance of a contract once it is late. */
export async function creditPortfolio(db: Executor) {
  const today = maputoDay();
  const contracts = rowsOf<{
    id: string;
    code: string;
    status: string;
    user_id: string;
    merchant: string;
    market: string;
    market_id: string;
    supplier: string;
    supplier_id: string;
    principal: string;
    outstanding: string;
    oldest_due: string | null;
  }>(
    await db.execute(sql`
      select c.id, c.code, c.status, c.user_id, u.display_name as merchant, m.name as market, m.id as market_id, s.name as supplier, s.id as supplier_id, c.principal_cents as principal,
        coalesce((select sum(i.amount_cents - i.paid_cents) from ukuphila.credit_instalments i where i.contract_id = c.id), c.principal_cents + c.fee_cents) as outstanding,
        (select min(i.due_date)::text from ukuphila.credit_instalments i where i.contract_id = c.id and i.status = 'em_atraso') as oldest_due
      from ukuphila.credit_contracts c
      join ukuphila.users u on u.id = c.user_id
      join ukuphila.businesses b on b.owner_id = c.user_id
      join ukuphila.markets m on m.id = b.market_id
      join ukuphila.suppliers s on s.id = c.supplier_id
      where c.status in ('aguarda_entrega','activo','em_atraso','incumprimento')
      order by outstanding desc
    `),
  );
  const rows = contracts.map((row) => {
    const lateDays = row.oldest_due ? Math.max(0, Math.round((Date.parse(today) - Date.parse(row.oldest_due)) / 86_400_000)) : 0;
    return { id: row.id, code: row.code, status: row.status, userId: row.user_id, merchant: row.merchant, market: row.market, marketId: row.market_id, supplier: row.supplier, supplierId: row.supplier_id, principalCents: Number(row.principal), outstandingCents: Number(row.outstanding), lateDays };
  });
  const exposure = rows.reduce((sum, row) => sum + row.outstandingCents, 0);
  const par = (days: number) => rows.filter((row) => row.lateDays > days).reduce((sum, row) => sum + row.outstandingCents, 0);
  const concentration = (key: "market" | "supplier") => {
    const totals = new Map<string, number>();
    for (const row of rows) totals.set(row[key], (totals.get(row[key]) ?? 0) + row.outstandingCents);
    return [...totals.entries()].map(([name, cents]) => ({ name, cents, share: exposure ? cents / exposure : 0 })).sort((a, b) => b.cents - a.cents);
  };
  const ageing = [
    { label: "Em dia", from: -1, to: 0 },
    { label: "1 a 7 dias", from: 0, to: 7 },
    { label: "8 a 30 dias", from: 7, to: 30 },
    { label: "31 a 90 dias", from: 30, to: 90 },
    { label: "Mais de 90", from: 90, to: Number.POSITIVE_INFINITY },
  ].map((bucket) => {
    const within = rows.filter((row) => row.lateDays > bucket.from && row.lateDays <= bucket.to);
    return { label: bucket.label, contracts: within.length, cents: within.reduce((sum, row) => sum + row.outstandingCents, 0) };
  });
  return { contracts: rows, exposure, par1: par(0), par7: par(7), par30: par(30), byMarket: concentration("market"), bySupplier: concentration("supplier"), ageing };
}

export async function creditPipeline(db: Executor) {
  const rows = await db.select({ status: creditApplications.status, total: sql<string>`count(*)`, cents: sql<string>`coalesce(sum(${creditApplications.requestedCents}), 0)` }).from(creditApplications).groupBy(creditApplications.status);
  return rows.map((row) => ({ status: row.status, total: Number(row.total), cents: Number(row.cents) }));
}

export async function repaymentStats(db: Executor) {
  const [row] = rowsOf<{ due: string; on_time: string; settled: string; collected: string }>(
    await db.execute(sql`
      select
        count(*) filter (where i.due_date <= current_date) as due,
        count(*) filter (where i.status = 'pago' and (i.paid_at at time zone 'Africa/Maputo')::date <= i.due_date) as on_time,
        (select count(*) from ukuphila.credit_contracts where status = 'liquidado') as settled,
        (select coalesce(sum(amount_cents), 0) from ukuphila.credit_repayments) as collected
      from ukuphila.credit_instalments i
    `),
  );
  return { due: Number(row?.due ?? 0), onTime: Number(row?.on_time ?? 0), settled: Number(row?.settled ?? 0), collectedCents: Number(row?.collected ?? 0) };
}

export async function riskOverview(db: Executor) {
  const [alerts, cases] = await Promise.all([
    db.select({ severity: riskAlerts.severity, status: riskAlerts.status, total: sql<string>`count(*)` }).from(riskAlerts).groupBy(riskAlerts.severity, riskAlerts.status),
    db.select({ status: riskCases.status, total: sql<string>`count(*)` }).from(riskCases).groupBy(riskCases.status),
  ]);
  const openBy = (severity: string) => Number(alerts.find((row) => row.severity === severity && row.status !== "fechado")?.total ?? 0);
  return {
    critical: openBy("critica"),
    high: openBy("alta"),
    medium: openBy("media"),
    low: openBy("baixa"),
    openCases: cases.filter((row) => row.status !== "fechado").reduce((sum, row) => sum + Number(row.total), 0),
  };
}

export async function recentContracts(db: Executor, limit = 8) {
  return db
    .select({ contract: creditContracts, supplierName: suppliers.name })
    .from(creditContracts)
    .innerJoin(suppliers, eq(suppliers.id, creditContracts.supplierId))
    .orderBy(desc(creditContracts.createdAt))
    .limit(limit);
}

export async function pilotStats(db: Executor) {
  const [[{ total: marketCount }], [{ total: open }], [{ total: kyc }], [{ total: syncs }]] = await Promise.all([
    db.select({ total: sql<string>`count(*)` }).from(markets),
    db.select({ total: sql<string>`count(*)` }).from(incidents),
    db.select({ total: sql<string>`count(*)` }).from(kycProfiles).where(sql`${kycProfiles.level} >= 1`),
    db.select({ total: sql<string>`count(*)` }).from(syncOps),
  ]);
  return { markets: Number(marketCount), incidents: Number(open), verified: Number(kyc), syncOps: Number(syncs) };
}
