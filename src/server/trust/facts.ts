import "server-only";
import { eq, sql } from "drizzle-orm";
import { daysAgo, maputoDay } from "@/lib/dates";
import { rowsOf, type Executor } from "../db/client";
import { kycProfiles, trustEvaluations } from "../db/schema";
import { getSetting } from "../settings";
import { evaluateTrust, type TrustFacts, type TrustResult } from "./engine";

export async function gatherFacts(db: Executor, userId: string): Promise<TrustFacts> {
  const now = new Date();
  const [activity, weekly, kyc, savings, xitique, credit] = await Promise.all([
    db.execute(sql`
      select
        count(distinct (occurred_at at time zone 'Africa/Maputo')::date) filter (where occurred_at >= ${daysAgo(14, now).toISOString()}::timestamptz) as d14,
        count(distinct (occurred_at at time zone 'Africa/Maputo')::date) filter (where occurred_at >= ${daysAgo(30, now).toISOString()}::timestamptz) as d30,
        count(distinct (occurred_at at time zone 'Africa/Maputo')::date) filter (where occurred_at >= ${daysAgo(90, now).toISOString()}::timestamptz) as d90,
        min(occurred_at) as first_at,
        count(*) filter (where kind = 'transferencia' and category = 'retirada_casa' and occurred_at >= ${daysAgo(60, now).toISOString()}::timestamptz) as transfers
      from ukuphila.journal_entries
      where user_id = ${userId} and kind in ('venda','venda_fiado','despesa','compra_stock','fiado_recebido','transferencia')
    `),
    db.execute(sql`
      select date_trunc('week', occurred_at at time zone 'Africa/Maputo') as week, sum(amount_cents) as total
      from ukuphila.journal_entries
      where user_id = ${userId} and kind in ('venda','venda_fiado') and occurred_at >= ${daysAgo(84, now).toISOString()}::timestamptz
      group by 1
    `),
    db.select({ level: kycProfiles.level }).from(kycProfiles).where(eq(kycProfiles.userId, userId)).limit(1),
    db.execute(sql`
      select
        count(distinct date_trunc('month', occurred_at at time zone 'Africa/Maputo')) filter (where kind = 'poupanca_deposito' and occurred_at >= ${daysAgo(182, now).toISOString()}::timestamptz) as months,
        coalesce(sum(case kind when 'poupanca_deposito' then amount_cents when 'poupanca_levantamento' then -amount_cents else 0 end), 0) as balance
      from ukuphila.journal_entries where user_id = ${userId} and kind in ('poupanca_deposito','poupanca_levantamento')
    `),
    db.execute(sql`
      select
        count(*) filter (where r.due_date <= ${maputoDay(now)}::date) as due,
        count(*) filter (where c.status = 'confirmada' and c.late_days = 0) as on_time
      from ukuphila.xitique_contributions c
      join ukuphila.xitique_rounds r on r.id = c.round_id
      join ukuphila.xitique_members m on m.id = c.member_id
      where m.user_id = ${userId}
    `),
    db.execute(sql`
      select
        count(*) filter (where i.due_date <= ${maputoDay(now)}::date) as due,
        count(*) filter (where i.status = 'pago' and (i.paid_at at time zone 'Africa/Maputo')::date <= i.due_date) as on_time,
        count(*) filter (where i.status = 'em_atraso') as overdue,
        (select count(*) from ukuphila.credit_contracts cc where cc.user_id = ${userId} and cc.status = 'liquidado') as settled
      from ukuphila.credit_instalments i
      join ukuphila.credit_contracts k on k.id = i.contract_id
      where k.user_id = ${userId}
    `),
  ]);
  const a = rowsOf<{ d14: string; d30: string; d90: string; first_at: string | null; transfers: string }>(activity)[0];
  const weeks = rowsOf<{ total: string }>(weekly).map((row) => Number(row.total));
  const mean = weeks.reduce((sum, value) => sum + value, 0) / (weeks.length || 1);
  const variance = weeks.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (weeks.length || 1);
  const s = rowsOf<{ months: string; balance: string }>(savings)[0];
  const x = rowsOf<{ due: string; on_time: string }>(xitique)[0];
  const c = rowsOf<{ due: string; on_time: string; overdue: string; settled: string }>(credit)[0];
  const firstAt = a?.first_at ? new Date(a.first_at) : null;
  return {
    monthsActive: firstAt ? Math.floor((now.getTime() - firstAt.getTime()) / (30 * 86_400_000)) : 0,
    activeDays14: Number(a?.d14 ?? 0),
    activeDays30: Number(a?.d30 ?? 0),
    activeDays90: Number(a?.d90 ?? 0),
    transfersToCasa60: Number(a?.transfers ?? 0),
    salesWeeksCv: weeks.length >= 4 && mean > 0 ? Math.sqrt(variance) / mean : null,
    kycLevel: kyc[0]?.level ?? 0,
    savingsMonths6: Number(s?.months ?? 0),
    savingsBalanceCents: Number(s?.balance ?? 0),
    xitiqueDue: Number(x?.due ?? 0),
    xitiqueOnTime: Number(x?.on_time ?? 0),
    creditInstalmentsDue: Number(c?.due ?? 0),
    creditInstalmentsOnTime: Number(c?.on_time ?? 0),
    creditOverdue: Number(c?.overdue ?? 0),
    supplierContractsSettled: Number(c?.settled ?? 0),
  };
}

export async function trustFor(db: Executor, userId: string): Promise<TrustResult & { facts: TrustFacts }> {
  const [facts, policy] = await Promise.all([gatherFacts(db, userId), getSetting(db, "trustPolicy")]);
  return { ...evaluateTrust(facts, policy), facts };
}

export async function storeEvaluation(db: Executor, userId: string, result: TrustResult) {
  await db.insert(trustEvaluations).values({ userId, policyVersion: result.policyVersion, ring: result.ring, readiness: result.readiness, signals: result.signals });
}
