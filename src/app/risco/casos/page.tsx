import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, PageHead } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { CASE_STATUS_LABELS, SEVERITY_LABELS, SEVERITY_TONES } from "@/lib/risk";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { listCases, logRiskViews } from "@/server/risk/queries";

export const metadata: Metadata = { title: "Casos de risco" };
export default async function CasesPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const user = await requirePage("risk.read", "/risco/casos");
  const closed = (await searchParams).estado === "fechados";
  const db = await getDb();
  const rows = await listCases(db, closed);
  await logRiskViews(db, user, rows.map(({ item }) => item.subjectUserId), "Casos /risco/casos");
  return <><PageHead eyebrow="Investigar com contexto" title="Casos" lead="Reúne os alertas, as notas da investigação e uma conclusão que fica no histórico." /><nav className="tabs-row" aria-label="Estado dos casos"><Link href="/risco/casos" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} aria-current={!closed ? "true" : undefined}>Em aberto</Link><Link href="/risco/casos?estado=fechados" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} aria-current={closed ? "true" : undefined}>Fechados</Link></nav>
    <p className="hint">Até 100 casos mais recentes nesta fila.</p>
    {!rows.length ? <EmptyState icon="shield" title="Nenhum caso nesta fila">Abre uma investigação a partir de um alerta.</EmptyState> : <div className="stack">{rows.map(({ item, subject }) => <article className="card" key={item.id}><div className="row-between wrap"><span className="mono">{item.code}</span><Badge tone={SEVERITY_TONES[item.severity]}>{SEVERITY_LABELS[item.severity]}</Badge></div><h2 className="card-title block"><Link style={{ minHeight: 44, display: "inline-flex", alignItems: "center", overflowWrap: "anywhere" }} href={`/risco/casos/${item.id}`}>{item.title}</Link></h2><p className="small muted">{subject ?? "Programa"} · {formatDateTime(item.createdAt)}</p><Badge>{CASE_STATUS_LABELS[item.status]}</Badge></article>)}</div>}
  </>;
}
