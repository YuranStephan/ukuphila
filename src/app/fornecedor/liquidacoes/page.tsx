import type { Metadata } from "next";
import { Badge, DataNote, EmptyState, PageHead, SectionTitle, Stat } from "@/components/ui";
import { formatDateTime, formatDay, maputoDay } from "@/lib/dates";
import { formatMT } from "@/lib/money";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { supplierProfile, supplierSettlements } from "@/server/supplier/queries";

export const metadata: Metadata = { title: "Liquidações do fornecedor" };

const STATUS_LABELS = { por_pagar: "Por pagar", parcial: "Pago em parte", pago: "Pago", em_atraso: "Em atraso" } as const;

export default async function SettlementsPage() {
  const user = await requirePage("supplier.portal", "/fornecedor/liquidacoes");
  const db = await getDb();
  const [supplier, { instalments, payments }] = await Promise.all([supplierProfile(db, user), supplierSettlements(db, user)]);
  const today = maputoDay();
  const outstanding = instalments.reduce((sum, row) => sum + row.amountCents - row.paidCents, 0);
  const overdue = instalments.filter((row) => row.dueDate < today).reduce((sum, row) => sum + row.amountCents - row.paidCents, 0);
  return <>
    <PageHead eyebrow={supplier?.name ?? "Portal do fornecedor"} title="Liquidações" lead="Acompanha as prestações dos teus contratos e os pagamentos registados ao teu fornecedor." />
    {!supplier ? <section className="card"><EmptyState icon="truck" title="Conta por associar">A gestão precisa de associar a tua conta ao fornecedor.</EmptyState></section> : <>
      <div className="stat-grid"><Stat label="Pagamentos registados" value={formatMT(payments.reduce((sum, row) => sum + row.amountCents, 0))} icon="coins" /><Stat label="Por liquidar após entrega" value={formatMT(outstanding)} /><Stat label="Prestações vencidas por pagar" value={formatMT(overdue)} tone={overdue ? "bad" : undefined} /></div>
      <DataNote>Consulta as prestações e os recebimentos registados por contrato. O plano de prestações é criado após a confirmação da entrega.</DataNote>
      <section className="block"><SectionTitle title="Plano de prestações" /><div className="card card-flush">{!instalments.length ? <EmptyState icon="document" title="Ainda sem prestações">O plano aparece quando a entrega é confirmada.</EmptyState> : <div className="table-wrap"><table className="table"><thead><tr><th scope="col">Contrato / comerciante</th><th scope="col">Prestação</th><th scope="col">Vencimento</th><th scope="col" className="right">Valor</th><th scope="col" className="right">Pago</th><th scope="col" className="right">Em falta</th><th scope="col">Estado</th></tr></thead><tbody>{instalments.map((row) => <tr key={row.id}><td><span className="mono">{row.code}</span><div className="tiny muted">{row.merchant}</div></td><td className="num">{row.number}</td><td>{formatDay(row.dueDate)}</td><td className="right num">{formatMT(row.amountCents)}</td><td className="right num">{formatMT(row.paidCents)}</td><td className="right num">{formatMT(row.amountCents - row.paidCents)}</td><td><Badge tone={row.status === "pago" ? "good" : row.dueDate < today && row.paidCents < row.amountCents ? "bad" : "neutral"}>{row.dueDate < today && row.paidCents < row.amountCents ? "Em atraso" : STATUS_LABELS[row.status]}</Badge></td></tr>)}</tbody></table></div>}</div></section>
      <section className="block"><SectionTitle title="Pagamentos recebidos registados" /><div className="card card-flush">{!payments.length ? <EmptyState icon="coins" title="Ainda sem pagamentos registados" /> : <div className="table-wrap"><table className="table"><thead><tr><th scope="col">Data</th><th scope="col">Contrato / comerciante</th><th scope="col">Método</th><th scope="col">Referência</th><th scope="col" className="right">Valor</th></tr></thead><tbody>{payments.map((row) => <tr key={row.id}><td>{formatDateTime(row.paidAt)}</td><td><span className="mono">{row.code}</span><div className="tiny muted">{row.merchant}</div></td><td>{row.method}</td><td className="mono">{row.reference}</td><td className="right num">{formatMT(row.amountCents)}</td></tr>)}</tbody></table></div>}</div></section>
    </>}
  </>;
}
