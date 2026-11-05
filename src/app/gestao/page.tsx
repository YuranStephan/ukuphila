import type { Metadata } from "next";
import Link from "next/link";
import { BarList, ColumnChart, Funnel, StackedLine, TableView } from "@/components/charts";
import { Badge, DataNote, PageHead, SectionTitle, Stat } from "@/components/ui";
import { formatShortDay } from "@/lib/dates";
import { formatCompact, formatMT, formatPct, pct } from "@/lib/money";
import { activitySeries, creditPipeline, creditPortfolio, marketBreakdown, programmeKpis, ringFunnel, riskOverview } from "@/server/analytics/programme";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Visão geral" };

const STAGE = { piloto: "Piloto", planeado: "Planeado", pausado: "Pausado" } as Record<string, string>;
const RING_NAMES = ["Caixa", "Poupança", "Xitique", "Crédito"];

export default async function GestaoHome() {
  await requirePage(["admin", "auditor", "kyc_reviewer", "credit_analyst", "credit_approver", "risk_analyst"]);
  const db = await getDb();
  const [kpis, series, rings, markets, portfolio, pipeline, risk] = await Promise.all([programmeKpis(db), activitySeries(db, 45), ringFunnel(db), marketBreakdown(db), creditPortfolio(db), creditPipeline(db), riskOverview(db)]);
  const open = pipeline.filter((row) => ["submetido", "em_analise", "recomendado"].includes(row.status)).reduce((sum, row) => sum + row.total, 0);
  return (
    <>
      <PageHead eyebrow="Gestão" title="Visão geral" lead="Tudo aqui vem das tabelas operacionais, sem números escritos à mão. A pergunta do piloto é uma só: as pessoas usam isto todos os dias?" />
      <div className="stat-grid">
        <Stat tone="night" icon="users" label="Comerciantes" value={kpis.merchants} hint={`${kpis.newMerchants30} novos em 30 dias`} href="/gestao/comerciantes" />
        <Stat icon="activity" label="Activos na semana" value={kpis.wau} hint={`${formatPct(pct(kpis.wau, kpis.mau))} dos activos no mês`} />
        <Stat icon="check" label="Activação" value={formatPct(pct(kpis.activated, kpis.merchants))} hint="Fizeram o primeiro registo" />
        <Stat icon="wallet" label="Separam os bolsos" value={formatPct(pct(kpis.separating, kpis.mau))} hint="Passaram dinheiro para casa em 30 dias" />
        <Stat icon="piggy" label="Poupam" value={formatPct(pct(kpis.savers, kpis.mau))} hint="Depósito nos últimos 60 dias" />
        <Stat icon="circle" label="Xitique" value={kpis.xitiqueGroups} hint={`${formatPct(pct(kpis.xitiqueOnTime, kpis.xitiqueDue))} das contribuições a tempo`} />
      </div>

      <div className="grid-2 block">
        <section className="card">
          <SectionTitle title="Registos por dia" action={<span className="tiny muted">Últimos 45 dias · {kpis.entries30.toLocaleString("pt-PT")} em 30 dias</span>} />
          <ColumnChart data={series.map((row) => ({ label: formatShortDay(row.day), entries: row.entries }))} series={[{ key: "entries", label: "Registos", color: "var(--serie-1)" }]} formatValue={(value) => Math.round(value).toLocaleString("pt-PT")} />
          <TableView head={["Dia", "Registos", "Comerciantes"]} rows={series.slice(-14).map((row) => [formatShortDay(row.day), row.entries, row.merchants])} />
        </section>
        <section className="card">
          <SectionTitle title="Quem está em que anel" />
          <Funnel steps={rings.map((row) => ({ label: RING_NAMES[row.ring - 1], value: row.total }))} />
          <h3 className="card-title" style={{ margin: "20px 0 10px" }}>
            Como registam
          </h3>
          <StackedLine
            formatValue={(value) => `${value} registos`}
            rows={[
              { label: "App", value: kpis.channels30.app, color: "var(--serie-1)" },
              { label: "Voz", value: kpis.channels30.voz, color: "var(--serie-2)" },
              { label: "WhatsApp", value: kpis.channels30.whatsapp, color: "var(--serie-3)" },
              { label: "Agente", value: kpis.channels30.agente, color: "var(--serie-4)" },
            ]}
          />
        </section>
      </div>

      <div className="grid-even block">
        <section className="card card-flush">
          <div style={{ padding: "18px 20px 6px" }}>
            <SectionTitle title="Mercados" />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mercado</th>
                  <th>Fase</th>
                  <th className="right">Comerciantes</th>
                  <th className="right">Activos</th>
                  <th className="right">Vendas 30 dias</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => (
                  <tr key={market.id}>
                    <td>{market.name}</td>
                    <td>
                      <Badge tone={market.stage === "piloto" ? "good" : "neutral"}>{STAGE[market.stage]}</Badge>
                    </td>
                    <td className="right num">{market.merchants}</td>
                    <td className="right num">{market.active}</td>
                    <td className="right num">{formatMT(market.salesCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <SectionTitle title="O que precisa de atenção" />
          <BarList
            formatValue={(value) => String(value)}
            max={Math.max(kpis.kycQueue, open, kpis.openIncidents, risk.high + risk.critical + risk.medium, 1)}
            rows={[
              { label: "Documentos na fila", value: kpis.kycQueue, hint: `Tempo médio de revisão: ${kpis.kycHours} h` },
              { label: "Crédito por decidir", value: open },
              { label: "Incidentes abertos", value: kpis.openIncidents, color: "var(--serie-2)" },
              { label: "Alertas de risco", value: risk.critical + risk.high + risk.medium, color: "var(--serie-4)" },
            ]}
          />
          <dl className="kv" style={{ marginTop: 14 }}>
            <div>
              <dt>Exposição de crédito</dt>
              <dd className="num">{formatMT(portfolio.exposure)}</dd>
            </div>
            <div>
              <dt>Em atraso há mais de 30 dias (PAR 30)</dt>
              <dd className="num">{formatPct(pct(portfolio.par30, portfolio.exposure), 1)}</dd>
            </div>
            <div>
              <dt>Falhas de sincronização (30 dias)</dt>
              <dd className="num">
                {kpis.syncRejected} de {kpis.syncTotal}
              </dd>
            </div>
          </dl>
          <p className="small" style={{ marginTop: 10 }}>
            <Link className="link" href="/risco">
              Abrir a sala de risco
            </Link>
          </p>
        </section>
      </div>
      <DataNote>Vendas registadas somam {formatCompact(kpis.salesRecorded30)} MT em 30 dias, a partir dos movimentos declarados pelos comerciantes.</DataNote>
    </>
  );
}
