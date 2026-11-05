import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addCaseNoteAction, closeCaseAction } from "@/actions/risk";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, EmptyState, PageHead, SectionTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { CASE_STATUS_LABELS, SEVERITY_LABELS, SEVERITY_TONES } from "@/lib/risk";
import { can } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { caseDetail, logRiskViews } from "@/server/risk/queries";

export const metadata: Metadata = { title: "Investigação de risco" };
export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("risk.read");
  const db = await getDb();
  const data = await caseDetail(db, (await params).id);
  if (!data) notFound();
  const { item, subject, notes, alerts } = data;
  await logRiskViews(db, user, [item.subjectUserId, ...alerts.map((alert) => alert.subjectUserId)], `Caso ${item.code}`);
  const manage = can(user.role, "risk.manage") && item.status !== "fechado";
  return <><Link href="/risco/casos" className="btn btn-secondary">← Casos</Link><PageHead eyebrow={item.code} title={item.title} lead={`${subject ?? "Programa"} · aberto em ${formatDateTime(item.createdAt)}`} actions={<><Badge tone={SEVERITY_TONES[item.severity]}>{SEVERITY_LABELS[item.severity]}</Badge><Badge>{CASE_STATUS_LABELS[item.status]}</Badge></>} />
    <section className="card"><SectionTitle title="Situação" /><p>{item.summary}</p>{item.conclusion ? <div className="callout block"><strong>Conclusão</strong><p style={{ whiteSpace: "pre-wrap" }}>{item.conclusion}</p><p className="tiny muted">{item.closedAt ? formatDateTime(item.closedAt) : ""}</p></div> : null}</section>
    <div className="grid-2 block"><section className="card"><SectionTitle title="Histórico da investigação" />{notes.length ? <div className="stack">{notes.map(({ note, author }) => <article key={note.id}><p className="tiny muted">{author} · {formatDateTime(note.createdAt)}</p><p className="small" style={{ whiteSpace: "pre-wrap" }}>{note.note}</p></article>)}</div> : <EmptyState title="Ainda sem notas" />}{manage ? <ActionForm className="stack block" action={addCaseNoteAction.bind(null, item.id)}><label className="field"><span>Nova nota</span><textarea className="input" name="note" rows={4} minLength={3} maxLength={4000} required /></label><SubmitButton>Registar nota</SubmitButton></ActionForm> : null}</section>
    <section className="card"><SectionTitle title="Alertas associados" />{alerts.map((alert) => <article className="block" key={alert.id}><strong className="small">{alert.title}</strong><p className="small muted">{alert.detail}</p></article>)}{manage ? <ActionForm className="stack block" action={closeCaseAction.bind(null, item.id)}><label className="field"><span>Conclusão da investigação</span><textarea className="input" name="conclusion" rows={5} minLength={10} maxLength={4000} required /></label><p className="tiny muted">Fechar o caso fecha também os alertas associados. A conclusão fica no histórico.</p><SubmitButton className="btn btn-secondary">Concluir e fechar caso</SubmitButton></ActionForm> : null}</section></div>
  </>;
}
