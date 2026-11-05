import type { Metadata } from "next";
import Link from "next/link";
import { resolveIncidentAction } from "@/actions/gestao";
import type { ActionState } from "@/actions/state";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, EmptyState, PageHead } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { INCIDENT_KIND_LABELS } from "@/lib/labels";
import { assertAgentIncident, logAgentSubjects } from "@/server/agent/queries";
import { agentIncidents, agentProfile } from "@/server/agent/service";
import { requireApi, requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { publicMessage } from "@/server/errors";

export const metadata: Metadata = { title: "Incidentes da tua carteira" };

async function resolveAssignedIncident(incidentId: string, state: ActionState, form: FormData): Promise<ActionState> {
  "use server";
  try {
    const user = await requireApi(["agent"]);
    const db = await getDb();
    const agent = await agentProfile(db, user.id);
    const merchantId = await assertAgentIncident(db, agent.id, incidentId);
    await logAgentSubjects(db, user, [merchantId], "agente.incidente.resolver");
    return await resolveIncidentAction(incidentId, state, form);
  } catch (error) { return { error: publicMessage(error) }; }
}

export default async function AgentIncidentsPage() {
  const user = await requirePage(["agent"], "/agente/incidentes");
  const db = await getDb();
  const agent = await agentProfile(db, user.id);
  const incidents = await agentIncidents(db, agent.id);
  await logAgentSubjects(db, user, incidents.flatMap(({ incident }) => incident.subjectUserId ? [incident.subjectUserId] : []), "agente.incidentes");
  const severity = { baixa: "Baixa", media: "Média", alta: "Alta" };
  return <>
    <PageHead eyebrow="Apoio no mercado" title="Incidentes" lead="Acompanha os pedidos da tua carteira e escreve o que ficou resolvido. Para abrir um pedido, entra na ficha do comerciante." />
    <div className="stack">
      {!incidents.length ? <section className="card stack"><EmptyState title="Nada em aberto" icon="check">Os pedidos da tua carteira estão tratados. Continua a acompanhar os comerciantes na ronda.</EmptyState><Link href="/agente" className="btn btn-ghost">Voltar à ronda</Link></section> : null}
      {incidents.map(({ incident, subjectName }) => <article key={incident.id} className="card stack" style={{ overflowWrap: "anywhere" }}>
        <div className="row-between wrap"><span className="tiny muted">{incident.code}</span><Badge tone={incident.severity === "alta" ? "bad" : "warn"}>{severity[incident.severity]} · {INCIDENT_KIND_LABELS[incident.kind]}</Badge></div>
        <h2 className="card-title">{incident.title}</h2><div className="row wrap small"><Link href={`/agente/comerciantes/${incident.subjectUserId}`} className="link" style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}>{subjectName}</Link><span>· {incident.status === "em_curso" ? "Em curso" : "Aberto"}</span></div>
        <p className="small" style={{ whiteSpace: "pre-wrap" }}>{incident.description}</p><p className="tiny muted">Aberto em {formatDateTime(incident.createdAt)}</p>
        <ActionForm action={resolveAssignedIncident.bind(null, incident.id)} success="Incidente resolvido.">
          <label className="field"><span className="label">Como ficou resolvido</span><textarea className="textarea" name="resolution" minLength={5} maxLength={2000} rows={3} required /></label>
          <SubmitButton className="btn btn-ghost">Registar resolução</SubmitButton>
        </ActionForm>
      </article>)}
    </div>
  </>;
}
