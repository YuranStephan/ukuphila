import type { Metadata } from "next";
import Link from "next/link";
import { runRulesAction } from "@/actions/risk";
import { RiskAlerts } from "@/components/console/risk-alerts";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHead } from "@/components/ui";
import { listAlerts } from "@/server/admin/queries";
import { can } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { logRiskViews } from "@/server/risk/queries";

export const metadata: Metadata = { title: "Alertas de risco" };
export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const user = await requirePage("risk.read");
  const closed = (await searchParams).estado === "fechados";
  const db = await getDb();
  const rows = await listAlerts(db, !closed);
  await logRiskViews(db, user, rows.map(({ alert }) => alert.subjectUserId), "Alertas /risco/alertas");
  return <><PageHead eyebrow="Sinais para investigar" title="Alertas" lead="Um alerta não prova fraude. Confirma o contexto, abre um caso ou fecha com um motivo." actions={can(user.role, "risk.manage") ? <ActionForm action={runRulesAction}><SubmitButton>Correr regras</SubmitButton></ActionForm> : null} /><nav className="tabs-row" aria-label="Estado dos alertas"><Link href="/risco/alertas" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} aria-current={!closed ? "true" : undefined}>Em aberto</Link><Link href="/risco/alertas?estado=fechados" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} aria-current={closed ? "true" : undefined}>Fechados</Link></nav><p className="hint">Até 80 alertas mais recentes nesta fila.</p><RiskAlerts rows={rows} manage={can(user.role, "risk.manage")} /></>;
}
