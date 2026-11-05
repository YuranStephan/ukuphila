import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Badge, EmptyState, PageHead, SectionTitle, Stat } from "@/components/ui";
import { formatDay, maputoDay, weekdayName } from "@/lib/dates";
import { logAgentSubjects } from "@/server/agent/queries";
import { agentIncidents, agentPortfolio, agentProfile, buildRonda } from "@/server/agent/service";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Ronda do dia" };
const priorities = [
  { value: 1, title: "Primeiro, quem precisa de ti", hint: "Pedidos de ajuda, documentos e prestações por acompanhar." },
  { value: 2, title: "Dar o próximo passo", hint: "Retoma o registo e ajuda a resolver o que ficou pendente." },
  { value: 3, title: "Manter a ligação", hint: "Passa pela banca e ouve como vai o negócio." },
] as const;

export default async function AgentPage() {
  const user = await requirePage(["agent"], "/agente");
  const db = await getDb();
  const agent = await agentProfile(db, user.id);
  const [ronda, portfolio, incidents] = await Promise.all([buildRonda(db, agent.id), agentPortfolio(db, agent.id), agentIncidents(db, agent.id)]);
  await logAgentSubjects(db, user, portfolio.map((merchant) => merchant.id), "agente.ronda");
  const day = maputoDay();
  return <>
    <PageHead eyebrow={`${weekdayName(day)} · ${formatDay(day)}`} title="Ronda do dia" lead={`O teu ponto de partida no ${agent.marketName}. Cada visita começa por ouvir.`}
      actions={<Link href="/agente/ganhos" className="btn btn-ghost"><Icon name="wallet" size={18} />Os teus ganhos</Link>} />
    <div className="stat-grid block">
      <Stat label="Na carteira" value={portfolio.length} icon="users" href="/agente/comerciantes" />
      <Stat label="A visitar hoje" value={new Set(ronda.map((item) => item.merchantId)).size} icon="map" tone="sun" />
      <Stat label="Incidentes abertos" value={incidents.length} icon="flag" href="/agente/incidentes" />
    </div>
    {ronda.length === 0 ? <section className="card stack">
      <EmptyState title={portfolio.length ? "A ronda está em dia" : "A tua carteira começa aqui"} icon={portfolio.length ? "check" : "users"}>
        {portfolio.length ? "Não há prioridades pendentes. Podes visitar os comerciantes para saber como vai o negócio." : "Apresenta o Ukuphila, ouve o comerciante e pede consentimento antes de criar a conta."}
      </EmptyState>
      <Link className="btn btn-primary" href={portfolio.length ? "/agente/comerciantes" : "/agente/novo"}>{portfolio.length ? "Ver comerciantes" : "Registar comerciante"}</Link>
    </section> : <div className="stack">
      {priorities.map((priority) => {
        const items = ronda.filter((item) => item.priority === priority.value);
        return items.length ? <section className="stack block" key={priority.value} aria-labelledby={`priority-${priority.value}`}>
          <div><h2 className="card-title" id={`priority-${priority.value}`}>{priority.title}</h2><p className="small muted">{priority.hint}</p></div>
          {items.map((item) => <Link className="ronda-item" data-priority={item.priority} key={`${item.merchantId}-${item.reason}`} href={`/agente/comerciantes/${item.merchantId}`}>
            <span className="ronda-p" aria-hidden="true" />
            <div className="grow" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
              <Badge tone={item.priority === 1 ? "bad" : item.priority === 2 ? "warn" : "neutral"}>{item.reason}</Badge>
              <p><strong>{item.name}</strong></p><p className="small muted">{item.businessName}{item.stall ? ` · Banca ${item.stall}` : ""}</p>
              <p className="small">{item.detail}</p>
            </div><Icon name="chevron" size={18} />
          </Link>)}
        </section> : null;
      })}
    </div>}
    <section className="card block"><SectionTitle title="No mercado, contigo" /><p className="small muted">Explica cada passo e confirma com o comerciante antes de fazer um registo por ele.</p></section>
  </>;
}
