import type { Metadata } from "next";
import Link from "next/link";
import { Badge, DataNote, EmptyState, PageHead, SectionTitle, Stat } from "@/components/ui";
import { CONTRACT_LABELS } from "@/lib/labels";
import { formatMT, formatPct } from "@/lib/money";
import { creditPortfolio } from "@/server/analytics/programme";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { logRiskViews } from "@/server/risk/queries";

export const metadata: Metadata = { title: "Carteira de crédito" };
export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ estado?: string | string[] }> }) {
  const user = await requirePage("risk.read", "/risco/carteira");
  const db = await getDb();
  const data = await creditPortfolio(db);
  const query = await searchParams;
  const states = ["aguarda_entrega", "activo", "em_atraso", "incumprimento"];
  const status = typeof query.estado === "string" && states.includes(query.estado) ? query.estado : "";
  const contracts = data.contracts.filter((row) => !status || row.status === status);
  await logRiskViews(db, user, contracts.map((row) => row.userId), "Carteira de crédito /risco/carteira");
  return <><PageHead eyebrow="Crédito fornecedor" title="Carteira e atrasos" lead="Acompanha o saldo por liquidar, a idade dos atrasos e a concentração em cada mercado e fornecedor." />
    <div className="stat-grid"><Stat label="Exposição contratada" value={formatMT(data.exposure)} /><Stat label="Atraso > 0 dias" value={formatMT(data.par1)} /><Stat label="Atraso > 7 dias" value={formatMT(data.par7)} /><Stat label="Atraso > 30 dias" value={formatMT(data.par30)} tone={data.par30 ? "bad" : undefined} /></div>
    <DataNote>O saldo total de um contrato entra em atraso se tiver uma prestação vencida. Os compromissos ainda sem entrega contam na exposição contratada e aparecem identificados na tabela.</DataNote>
    <div className="grid-even block">{[{ title: "Por mercado", rows: data.byMarket }, { title: "Por fornecedor", rows: data.bySupplier }].map((group) => <section className="card" key={group.title}><SectionTitle title={group.title} /><dl className="kv">{group.rows.map((row) => <div key={row.name}><dt>{row.name}</dt><dd>{formatMT(row.cents)} <span className="tiny muted">· {formatPct(row.share)}</span></dd></div>)}</dl></section>)}</div>
    <section className="card block"><SectionTitle title="Idade dos atrasos" /><dl className="kv">{data.ageing.map((row) => <div key={row.label}><dt>{row.label} · {row.contracts} contratos</dt><dd className="num">{formatMT(row.cents)}</dd></div>)}</dl></section>
    <form className="toolbar block" action="/risco/carteira" method="get"><label className="field grow" htmlFor="portfolio-status"><span>Estado do contrato</span><select className="select" id="portfolio-status" name="estado" defaultValue={status} style={{ minHeight: 44 }}><option value="">Todos os estados em carteira</option>{states.map((value) => <option key={value} value={value}>{CONTRACT_LABELS[value]}</option>)}</select></label><button className="btn btn-secondary" type="submit">Filtrar</button></form>
    <section className="card card-flush block">{!contracts.length ? <EmptyState title="Nenhum contrato nesta lista" /> : <div className="table-wrap"><table className="table"><thead><tr><th scope="col">Contrato</th><th scope="col">Comerciante</th><th scope="col">Fornecedor</th><th scope="col">Estado</th><th scope="col">Atraso</th><th scope="col" className="right">Por liquidar</th></tr></thead><tbody>{contracts.map((row) => <tr key={row.id}><td className="mono">{row.code}</td><td><Link href={`/gestao/comerciantes/${row.userId}`}>{row.merchant}</Link><div className="tiny muted">{row.market}</div></td><td>{row.supplier}</td><td><Badge tone={row.lateDays > 0 ? "bad" : row.status === "aguarda_entrega" ? "warn" : "good"}>{CONTRACT_LABELS[row.status]}</Badge></td><td>{row.lateDays ? `${row.lateDays} dias` : "—"}</td><td className="right num">{formatMT(row.outstandingCents)}</td></tr>)}</tbody></table></div>}</section>
  </>;
}
