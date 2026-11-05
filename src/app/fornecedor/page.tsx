import type { Metadata } from "next";
import { confirmDeliveryAction } from "@/actions/credit";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, DataNote, EmptyState, PageHead, SectionTitle, Stat } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { CONTRACT_LABELS } from "@/lib/labels";
import { formatMT } from "@/lib/money";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { supplierOrders, supplierProfile } from "@/server/supplier/queries";

export const metadata: Metadata = { title: "Encomendas do fornecedor" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ estado?: string | string[] }> }) {
  const user = await requirePage("supplier.portal", "/fornecedor");
  const db = await getDb();
  const [supplier, orders, query] = await Promise.all([supplierProfile(db, user), supplierOrders(db, user), searchParams]);
  const status = typeof query.estado === "string" && Object.hasOwn(CONTRACT_LABELS, query.estado) ? query.estado : "";
  const filtered = orders.filter((order) => !status || order.status === status);
  return <>
    <PageHead eyebrow={supplier?.name ?? "Portal do fornecedor"} title="Encomendas" lead="Prepara o stock e confirma a entrega com o código que o comerciante te der no momento da recepção." />
    {!supplier ? <section className="card"><EmptyState icon="truck" title="Conta por associar">A gestão precisa de associar a tua conta ao fornecedor para veres as encomendas.</EmptyState></section> : <>
      <div className="stat-grid">
        <Stat label="Por entregar" value={orders.filter((row) => row.status === "aguarda_entrega").length} icon="truck" />
        <Stat label="Em pagamento" value={orders.filter((row) => ["activo", "em_atraso", "incumprimento"].includes(row.status)).length} icon="coins" />
        <Stat label="Liquidadas" value={orders.filter((row) => row.status === "liquidado").length} icon="check" />
      </div>
      <DataNote>A dívida só começa quando confirmas a entrega com o código do comerciante.</DataNote>
      <form className="toolbar block" action="/fornecedor" method="get">
        <label className="field grow" htmlFor="order-status"><span>Estado da encomenda</span><select className="select" id="order-status" name="estado" defaultValue={status} style={{ minHeight: 44 }}><option value="">Todos os estados</option>{Object.entries(CONTRACT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button className="btn btn-secondary" type="submit">Filtrar</button>
      </form>
      {!filtered.length ? <section className="card"><EmptyState icon="box" title="Nenhuma encomenda nesta lista">As encomendas aparecem depois de o comerciante aceitar uma proposta de crédito.</EmptyState></section> : <div className="stack">
        {filtered.map((order) => <article className="card" key={order.id}>
          <div className="row-between wrap"><h2 className="card-title">{order.code} · {order.merchant}</h2><Badge tone={order.status === "aguarda_entrega" ? "warn" : ["em_atraso", "incumprimento"].includes(order.status) ? "bad" : "neutral"}>{CONTRACT_LABELS[order.status]}</Badge></div>
          <p className="tiny muted block">Aceite em {formatDateTime(order.acceptedAt)}{order.deliveredAt ? ` · Entregue em ${formatDateTime(order.deliveredAt)}` : ""}</p>
          <dl className="kv block">{order.items.map((item, index) => <div key={index}><dt>{item.quantity} {item.unit} de {item.name}</dt><dd className="num">{formatMT(Math.round(item.quantity * item.priceCents))}</dd></div>)}<div><dt>Stock contratado</dt><dd className="num">{formatMT(order.principalCents)}</dd></div><div><dt>Custo contratual</dt><dd className="num">{formatMT(order.feeCents)}</dd></div><div><dt>Total do contrato · {order.termDays} dias</dt><dd className="num">{formatMT(order.principalCents + order.feeCents)}</dd></div></dl>
          {order.status === "aguarda_entrega" ? <div className="block"><SectionTitle title="Confirmar a entrega" /><ActionForm action={confirmDeliveryAction.bind(null, order.id)}>
            <label className="field" htmlFor={`delivery-${order.id}`}><span>Código do comerciante</span><input className="input mono" id={`delivery-${order.id}`} name="code" required autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-describedby={`delivery-help-${order.id}`} /></label>
            <p className="hint" id={`delivery-help-${order.id}`}>Confirma apenas depois de entregar o stock. Pede ao comerciante o código que aparece no contrato dele.</p>
            <SubmitButton>Confirmar stock entregue</SubmitButton>
          </ActionForm></div> : null}
        </article>)}
      </div>}
    </>}
  </>;
}
