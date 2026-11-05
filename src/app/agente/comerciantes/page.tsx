import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Badge, EmptyState, PageHead } from "@/components/ui";
import { relativeTime } from "@/lib/dates";
import { KYC_LEVEL_LABELS } from "@/lib/labels";
import { logAgentSubjects } from "@/server/agent/queries";
import { agentPortfolio, agentProfile } from "@/server/agent/service";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "A tua carteira" };
const statuses: Record<string, string> = { preliminar: "Registo inicial", activo: "Activo", suspenso: "Suspenso", encerrado: "Encerrado" };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-MZ");

export default async function AgentMerchantsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const user = await requirePage(["agent"], "/agente/comerciantes");
  const db = await getDb();
  const agent = await agentProfile(db, user.id);
  const portfolio = await agentPortfolio(db, agent.id);
  await logAgentSubjects(db, user, portfolio.map((merchant) => merchant.id), "agente.carteira");
  const query = (await searchParams).q;
  const q = (typeof query === "string" ? query : "").trim().slice(0, 100);
  const merchants = portfolio.filter((merchant) => normalize(merchant.name).includes(normalize(q)) || normalize(merchant.businessName).includes(normalize(q)));
  return <>
    <PageHead eyebrow={agent.marketName} title="A tua carteira" lead="As pessoas e os negócios que acompanhas, uma visita de cada vez."
      actions={<Link href="/agente/novo" className="btn btn-primary"><Icon name="plus" size={18} />Novo comerciante</Link>} />
    <form method="get" action="/agente/comerciantes" role="search" className="card stack block">
      <label className="field"><span className="label">Procurar por nome ou negócio</span><input className="input" type="search" name="q" defaultValue={q} maxLength={100} autoComplete="off" /></label>
      <div className="row wrap"><button className="btn btn-primary" type="submit"><Icon name="search" size={18} />Procurar</button>{q ? <Link className="btn btn-ghost" href="/agente/comerciantes">Limpar pesquisa</Link> : null}</div>
    </form>
    <p className="small muted block" role="status">{merchants.length} de {portfolio.length} comerciantes{q ? ` · Pesquisa: ${q}` : ""}</p>
    <div className="stack">
      {merchants.map((merchant) => <Link className="card stack" key={merchant.id} href={`/agente/comerciantes/${merchant.id}`} style={{ textDecoration: "none", overflowWrap: "anywhere" }}>
        <div className="row-between wrap"><strong>{merchant.name}</strong><Badge tone={merchant.status === "activo" ? "good" : "neutral"}>{statuses[merchant.status] ?? merchant.status}</Badge></div>
        <p className="small">{merchant.businessName} · {merchant.activity}</p><p className="small muted">{merchant.stall ? `Banca ${merchant.stall}` : "Banca por indicar"}</p>
        <div className="row wrap"><Badge tone={merchant.level > 0 ? "good" : "warn"}>{KYC_LEVEL_LABELS[merchant.level] ?? `Nível ${merchant.level}`}</Badge><span className="tiny muted">{merchant.entries30} registos nos últimos 30 dias</span></div>
        <p className="tiny muted">{merchant.lastAt ? `Último registo ${relativeTime(merchant.lastAt)}` : "Ainda sem registos"}</p>
      </Link>)}
      {!merchants.length ? <section className="card stack"><EmptyState title={q ? "Nenhum nome encontrado" : "Ainda sem comerciantes"} icon="users">{q ? "Confirma o nome ou limpa a pesquisa para ver a carteira." : "O primeiro passo é apresentar o serviço e ouvir a pessoa."}</EmptyState><Link className="btn btn-ghost" href={q ? "/agente/comerciantes" : "/agente/novo"}>{q ? "Ver toda a carteira" : "Registar comerciante"}</Link></section> : null}
    </div>
  </>;
}
