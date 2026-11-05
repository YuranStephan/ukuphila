import Link from "next/link";
import { closeAlertAction, openCaseAction } from "@/actions/risk";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { ALERT_STATUS_LABELS, SEVERITY_LABELS, SEVERITY_TONES } from "@/lib/risk";
import type { listAlerts } from "@/server/admin/queries";

export function RiskAlerts({ rows, manage = false }: { rows: Awaited<ReturnType<typeof listAlerts>>; manage?: boolean }) {
  if (!rows.length) return <EmptyState icon="shield" title="Nenhum alerta nesta fila">As situações encontradas pelas regras aparecem aqui.</EmptyState>;
  return <div className="stack">{rows.map(({ alert, name }) => (
    <article className="card" key={alert.id}>
      <div className="row-between wrap"><div className="row wrap"><Badge tone={SEVERITY_TONES[alert.severity]}>{SEVERITY_LABELS[alert.severity]}</Badge><Badge>{ALERT_STATUS_LABELS[alert.status]}</Badge></div><span className="tiny muted">{formatDateTime(alert.createdAt)}</span></div>
      <h2 className="card-title block">{alert.title}</h2>
      <p className="small muted">{alert.detail}</p>
      {name ? <p className="small block">Pessoa associada: {name}</p> : null}
      <p className="tiny muted mono block">Regra: {alert.rule}</p>
      {alert.caseId ? <Link className="btn btn-secondary block" href={`/risco/casos/${alert.caseId}`}>Abrir caso</Link> : null}
      {alert.closureNote ? <p className="callout block">Conclusão: {alert.closureNote}</p> : null}
      {manage && alert.status !== "fechado" && !alert.caseId ? <div className="grid-even block">
        <ActionForm action={openCaseAction.bind(null, alert.id)}><SubmitButton>Abrir investigação</SubmitButton></ActionForm>
        <ActionForm action={closeAlertAction.bind(null, alert.id)}><label className="field"><span>Motivo do fecho</span><textarea className="input" name="note" required minLength={5} maxLength={4000} rows={2} /></label><SubmitButton className="btn btn-secondary">Fechar alerta</SubmitButton></ActionForm>
      </div> : null}
    </article>
  ))}</div>;
}
