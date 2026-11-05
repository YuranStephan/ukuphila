import type { Metadata } from "next";
import Link from "next/link";
import { BarList, TableView } from "@/components/charts";
import { DataNote, EmptyState, PageHead, SectionTitle, Stat } from "@/components/ui";
import { APPLICATION_LABELS } from "@/lib/labels";
import { formatMT, formatPct } from "@/lib/money";
import { creditPipeline, creditPortfolio, repaymentStats, riskOverview } from "@/server/analytics/programme";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Sala de risco" };

export default async function RiskPage() {
  await requirePage("risk.read", "/risco");
  const db = await getDb();
  const [portfolio, repayments, risk, pipeline] = await Promise.all([creditPortfolio(db), repaymentStats(db), riskOverview(db), creditPipeline(db)]);
  const alerts = [
    { label: "Crítica", value: risk.critical, color: "var(--serie-1)" },
    { label: "Alta", value: risk.high, color: "var(--serie-2)" },
    { label: "Média", value: risk.medium, color: "var(--serie-3)" },
    { label: "Baixa", value: risk.low, color: "var(--serie-4)" },
  ];
  return <>
    <PageHead eyebrow="Observar · compreender · agir" title="Sala de risco" lead="Acompanha a exposição, os atrasos e os sinais que precisam de investigação. As decisões ficam com as pessoas." actions={<Link className="btn btn-secondary" href="/risco/alertas">Ver alertas</Link>} />
    <div className="stat-grid">
      <Stat label="Exposição contratada" value={formatMT(portfolio.exposure)} hint={`${portfolio.contracts.length} contratos, incluindo entregas pendentes`} icon="coins" />
      {[{ label: "PAR 1", value: portfolio.par1, hint: "Atraso de pelo menos 1 dia" }, { label: "PAR 7", value: portfolio.par7, hint: "Atraso superior a 7 dias" }, { label: "PAR 30", value: portfolio.par30, hint: "Atraso superior a 30 dias" }].map((par) => <Stat key={par.label} label={par.label} value={formatMT(par.value)} hint={`${portfolio.exposure ? formatPct(par.value / portfolio.exposure, 1) : "—"} da exposição · ${par.hint}`} tone={par.value ? "bad" : undefined} />)}
    </div>
    <DataNote>PAR inclui todo o saldo por liquidar de um contrato com atraso, com capital e custos contratados. A exposição inclui compromissos ainda por entregar.</DataNote>
    <div className="grid-2 block">
      <section className="card"><SectionTitle title="Idade dos atrasos" action={<Link href="/risco/carteira">Ver carteira</Link>} />
        {portfolio.exposure ? <BarList rows={portfolio.ageing.map((row) => ({ label: row.label, value: row.cents, hint: `${row.contracts} contratos` }))} formatValue={formatMT} /> : <EmptyState icon="coins" title="Ainda sem exposição">Os contratos aparecem depois de o comerciante aceitar uma proposta.</EmptyState>}
        <TableView head={["Atraso", "Contratos", "Por liquidar"]} rows={portfolio.ageing.map((row) => [row.label, row.contracts, formatMT(row.cents)])} />
      </section>
      <section className="card"><SectionTitle title="Alertas abertos por gravidade" action={<Link href="/risco/alertas">Investigar</Link>} />
        {alerts.some((row) => row.value) ? <BarList rows={alerts} formatValue={(value) => String(value)} /> : <EmptyState icon="shield" title="Sem alertas em aberto" />}
        <TableView head={["Gravidade", "Alertas"]} rows={alerts.map((row) => [row.label, row.value])} />
        <p className="small muted block"><Link href="/risco/casos">{risk.openCases} casos em aberto</Link>. Um alerta pede verificação; não prova fraude.</p>
      </section>
    </div>
    <div className="grid-even block">{[{ title: "Concentração por mercado", rows: portfolio.byMarket }, { title: "Concentração por fornecedor", rows: portfolio.bySupplier }].map((group) => <section className="card" key={group.title}><SectionTitle title={group.title} />
      {group.rows.length ? <><BarList rows={group.rows.map((row) => ({ label: row.name, value: row.cents, hint: formatPct(row.share, 1) }))} formatValue={formatMT} max={Math.max(portfolio.exposure, 1)} /><TableView head={["Grupo", "Exposição", "Quota"]} rows={group.rows.map((row) => [row.name, formatMT(row.cents), formatPct(row.share, 1)])} /></> : <EmptyState title="Ainda sem concentração a apresentar" />}
    </section>)}</div>
    <div className="stat-grid block">
      <Stat label="Prestações pagas a tempo" value={repayments.due ? formatPct(repayments.onTime / repayments.due, 1) : "—"} hint={`${repayments.onTime} a tempo · ${repayments.due} vencidas até hoje`} icon="check" />
      <Stat label="Pagamentos registados" value={formatMT(repayments.collectedCents)} icon="coins" />
      <Stat label="Contratos liquidados" value={repayments.settled} icon="document" />
    </div>
    <section className="card block"><SectionTitle title="Pedidos de crédito por estado" />
      {pipeline.length ? <><BarList rows={pipeline.map((row) => ({ label: APPLICATION_LABELS[row.status], value: row.total, hint: formatMT(row.cents) }))} formatValue={(value) => String(value)} /><TableView head={["Estado", "Pedidos", "Valor pedido"]} rows={pipeline.map((row) => [APPLICATION_LABELS[row.status], row.total, formatMT(row.cents)])} /></> : <EmptyState icon="document" title="Ainda sem pedidos de crédito" />}
    </section>
  </>;
}
