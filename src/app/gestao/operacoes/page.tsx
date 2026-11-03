import type { Metadata } from "next";
import { resolveConflictAction, resolveIncidentAction } from "@/actions/gestao";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, EmptyState, PageHead, SectionTitle, Stat } from "@/components/ui";
import { relativeTime } from "@/lib/dates";
import { CONFLICT_LABELS, INCIDENT_KIND_LABELS } from "@/lib/labels";
import { formatPct, pct } from "@/lib/money";
import { listConflicts, listIncidents } from "@/server/admin/queries";
import { programmeKpis } from "@/server/analytics/programme";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Incidentes e sincronização" };

export default async function OperationsPage() {
  await requirePage("ops.read");
  const db = await getDb();
  const [incidents, conflicts, kpis] = await Promise.all([listIncidents(db), listConflicts(db), programmeKpis(db)]);
  const open = incidents.filter(({ incident }) => incident.status !== "resolvido");
  return (
    <>
      <PageHead eyebrow="Operação" title="Incidentes e sincronização" lead="O que falhou, a quem aconteceu e quem está a tratar. Nenhum registo offline se perde: o que está em dúvida fica aqui para rever." />
      <div className="stat-grid">
        <Stat tone="sun" icon="alert" label="Incidentes abertos" value={open.length} />
        <Stat icon="sync" label="Operações sincronizadas" value={kpis.syncTotal} hint="Últimos 30 dias" />
        <Stat icon="flag" label="Por rever" value={conflicts.length} />
        <Stat icon="x" label="Recusadas" value={formatPct(pct(kpis.syncRejected, kpis.syncTotal), 1)} hint={`${kpis.syncRejected} operações`} />
      </div>
      <div className="grid-even block">
        <section className="card">
          <SectionTitle title="Incidentes" />
          {open.length === 0 ? <EmptyState title="Nada em aberto" icon="check" /> : null}
          <div className="stack">
            {open.map(({ incident, name }) => (
              <article key={incident.id} className="stack" style={{ ["--gap" as string]: "6px", paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
                <div className="row-between">
                  <strong>{incident.title}</strong>
                  <Badge tone={incident.severity === "alta" ? "bad" : "warn"}>{INCIDENT_KIND_LABELS[incident.kind]}</Badge>
                </div>
                <p className="small muted">
                  {name ?? "Sem pessoa"} · {incident.code} · {relativeTime(incident.createdAt)}
                </p>
                <p className="small">{incident.description}</p>
                <ActionForm action={resolveIncidentAction.bind(null, incident.id)} className="row wrap">
                  <input className="input grow" name="resolution" placeholder="Como ficou resolvido" aria-label="Resolução" style={{ minWidth: 180 }} />
                  <SubmitButton className="btn btn-ghost btn-s">Resolver</SubmitButton>
                </ActionForm>
              </article>
            ))}
          </div>
        </section>
        <section className="card">
          <SectionTitle title="Registos por rever" />
          {conflicts.length === 0 ? <EmptyState title="Nada por rever" icon="check" /> : null}
          <div className="stack">
            {conflicts.map(({ conflict, name }) => (
              <article key={conflict.id} className="row-between" style={{ paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
                <div className="grow">
                  <strong className="small">{CONFLICT_LABELS[conflict.kind] ?? conflict.kind}</strong>
                  <p className="tiny muted">
                    {name} · {relativeTime(conflict.createdAt)}
                  </p>
                  <p className="small">{conflict.message}</p>
                </div>
                <ActionForm action={resolveConflictAction.bind(null, conflict.id)}>
                  <SubmitButton className="btn btn-ghost btn-s">Marcar resolvido</SubmitButton>
                </ActionForm>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
