import "server-only";
import { sql } from "drizzle-orm";
import { daysAgo, maputoDay } from "@/lib/dates";
import { formatMT, formatPct } from "@/lib/money";
import { creditPortfolio } from "../analytics/programme";
import { rowsOf, type Db } from "../db/client";
import { activePolicy } from "../credit/service";
import { raiseAlert } from "./alerts";

/*
 * Automated rules raise questions, never verdicts: each alert goes to a person who opens a case or closes it with a note.
 * "Fraude" here means "merece ser visto", which is why the wording of the detail never accuses anyone.
 */
export async function runRiskRules(db: Db) {
  const today = maputoDay();
  let raised = 0;

  // A day far above the merchant's own normal: often a typo, sometimes an attempt to inflate history.
  const spikes = rowsOf<{ user_id: string; day: string; total: string; median: string }>(
    await db.execute(sql`
      with daily as (
        select user_id, (occurred_at at time zone 'Africa/Maputo')::date as day, sum(amount_cents) as total
        from ukuphila.journal_entries where kind in ('venda','venda_fiado') and occurred_at >= ${daysAgo(35).toISOString()}::timestamptz
        group by 1, 2
      ), normal as (
        select user_id, percentile_cont(0.5) within group (order by total) as median, count(*) as days from daily group by 1
      )
      select d.user_id, d.day::text as day, d.total, n.median
      from daily d join normal n using (user_id)
      where d.day >= ${today}::date - 3 and n.days >= 10 and d.total > 5 * n.median
    `),
  );
  for (const row of spikes) {
    await raiseAlert(db, {
      rule: "venda_fora_do_padrao",
      severity: "media",
      title: "Dia de vendas muito acima do habitual",
      detail: `Registou ${formatMT(Number(row.total))} num dia, para uma mediana de ${formatMT(Math.round(Number(row.median)))}. Confirmar com o agente.`,
      subjectUserId: row.user_id,
      dedupeKey: `venda_fora_do_padrao:${row.user_id}:${row.day}`,
      evidence: { day: row.day, total: Number(row.total), median: Number(row.median) },
    });
    raised += 1;
  }

  // Corrections concentrated in records made by one agent.
  const agents = rowsOf<{ recorded_by: string; name: string; reversals: string }>(
    await db.execute(sql`
      select e.recorded_by, u.display_name as name, count(*) as reversals
      from ukuphila.journal_entries e join ukuphila.users u on u.id = e.recorded_by
      where e.kind = 'estorno' and u.role = 'agent' and e.recorded_at >= ${daysAgo(14).toISOString()}::timestamptz
      group by 1, 2 having count(*) >= 8
    `),
  );
  for (const row of agents) {
    await raiseAlert(db, {
      rule: "agente_estornos",
      severity: "alta",
      title: "Muitas correcções feitas por um agente",
      detail: `${row.name} fez ${row.reversals} correcções em 14 dias. Rever o motivo com a supervisão.`,
      subjectUserId: row.recorded_by,
      dedupeKey: `agente_estornos:${row.recorded_by}:${today.slice(0, 7)}`,
      evidence: { reversals: Number(row.reversals) },
    });
    raised += 1;
  }

  const policy = await activePolicy(db);
  const portfolio = await creditPortfolio(db);
  const limit = (policy?.params.concentrationLimitPct ?? 40) / 100;
  for (const [dimension, rows] of [["mercado", portfolio.byMarket], ["fornecedor", portfolio.bySupplier]] as const) {
    for (const row of rows) {
      if (row.share <= limit || portfolio.contracts.length < 4) continue;
      await raiseAlert(db, {
        rule: "concentracao",
        severity: "media",
        title: `Concentração por ${dimension}: ${row.name}`,
        detail: `${formatPct(row.share)} da exposição (${formatMT(row.cents)}), acima do limite de ${formatPct(limit)}.`,
        dedupeKey: `concentracao:${dimension}:${row.name}:${today.slice(0, 7)}`,
        evidence: { share: row.share, cents: row.cents },
      });
      raised += 1;
    }
  }

  // Merchants who were regular and went silent. Usually an agent visit solves it, so this is an operations signal.
  const silent = rowsOf<{ user_id: string; last_day: string }>(
    await db.execute(sql`
      select user_id, max(occurred_at)::date::text as last_day from ukuphila.journal_entries
      group by 1
      having max(occurred_at) < ${daysAgo(14).toISOString()}::timestamptz and max(occurred_at) >= ${daysAgo(45).toISOString()}::timestamptz and count(*) > 30
    `),
  );
  for (const row of silent) {
    await raiseAlert(db, {
      rule: "silencio",
      severity: "baixa",
      title: "Comerciante deixou de registar",
      detail: `Último registo em ${row.last_day}. Pedir ao agente uma visita.`,
      subjectUserId: row.user_id,
      dedupeKey: `silencio:${row.user_id}:${today.slice(0, 7)}`,
      evidence: { lastDay: row.last_day },
    });
    raised += 1;
  }
  return raised;
}
