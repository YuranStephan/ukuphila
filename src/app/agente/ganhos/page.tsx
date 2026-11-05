import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, PageHead, SectionTitle, Stat } from "@/components/ui";
import { formatDateTime, maputoDay } from "@/lib/dates";
import { formatMT } from "@/lib/money";
import { agentEarningsByMonth, agentRecentVisits, logAgentSubjects } from "@/server/agent/queries";
import { agentProfile } from "@/server/agent/service";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Os teus ganhos" };
const monthName = (month: string) => new Intl.DateTimeFormat("pt-MZ", { month: "long", year: "numeric", timeZone: "Africa/Maputo" }).format(new Date(`${month}-01T12:00:00Z`));

export default async function AgentEarningsPage() {
  const user = await requirePage(["agent"], "/agente/ganhos");
  const db = await getDb();
  const agent = await agentProfile(db, user.id);
  const [months, visits] = await Promise.all([agentEarningsByMonth(db, agent.id), agentRecentVisits(db, agent.id)]);
  await logAgentSubjects(db, user, visits.map((visit) => visit.merchantId), "agente.visitas");
  const current = months.find((month) => month.month === maputoDay().slice(0, 7));
  return <>
    <PageHead eyebrow={agent.marketName} title="Os teus ganhos" lead="Comissões registadas pelo sistema. A gestão valida as condições e trata do pagamento."
      actions={<Link className="btn btn-ghost" href="/agente">Voltar à ronda</Link>} />
    <div className="stat-grid block"><Stat label="Registado este mês" value={formatMT(current?.amountCents ?? 0)} tone="sun" hint={current?.pending ? "Inclui valores por validar pela gestão" : "Comissões do mês"} /><Stat label="Registos este mês" value={current?.count ?? 0} /></div>
    <section className="stack block"><SectionTitle title="Por mês" />
      {!months.length ? <div className="card"><EmptyState title="Ainda sem comissões" icon="wallet">Quando houver comissões registadas para ti, aparecem aqui por mês.</EmptyState></div> : months.map((month) => <article key={month.month} className="card stack"><div className="row-between wrap"><h3 className="card-title">{monthName(month.month)}</h3><strong className="num">{formatMT(month.amountCents)}</strong></div><p className="small muted">{month.count} registos de comissão</p>{month.pending ? <Badge tone="warn">{month.pending} por validar pela gestão</Badge> : null}</article>)}
    </section>
    <section className="stack"><SectionTitle title="Visitas recentes" />
      {!visits.length ? <div className="card"><EmptyState title="Ainda sem visitas registadas" icon="map">Regista cada visita na ficha do comerciante, com o motivo e o resultado.</EmptyState></div> : visits.map((visit) => <article className="card stack" key={visit.id} style={{ overflowWrap: "anywhere" }}><h3 className="card-title"><Link className="link" style={{ display: "flex", alignItems: "center", minHeight: 44 }} href={`/agente/comerciantes/${visit.merchantId}`}>{visit.merchantName}</Link></h3><p className="tiny muted">{visit.businessName} · {formatDateTime(visit.at)}</p><p className="small"><strong>{visit.purpose}</strong> · {visit.outcome}</p>{visit.note ? <p className="small muted" style={{ whiteSpace: "pre-wrap" }}>{visit.note}</p> : null}</article>)}
    </section>
  </>;
}
