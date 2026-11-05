"use client";

import { useMemo, useState } from "react";
import { Rings } from "@/components/brand";
import { Icon, type IconName } from "@/components/icon";
import { formatShortDay, formatTime, greeting, maputoDay, relativeTime, addDays } from "@/lib/dates";
import { ENTRY_LABELS, EXPENSE_CATEGORIES, POCKET_LABELS } from "@/lib/labels";
import { formatMT, parseAmountToCents } from "@/lib/money";
import { AmountPad, Card, Chips, Empty, Money, Row, Screen, Sheet, Speak, useBusy } from "./kit";
import type { RecordKind } from "./register";
import { useStore, type Snapshot } from "./store";

const INCOME = new Set(["venda", "fiado_recebido", "entrada_capital", "xitique_recebimento", "poupanca_levantamento"]);
const ENTRY_ICON: Record<string, IconName> = {
  venda: "arrowDown",
  venda_fiado: "users",
  fiado_recebido: "arrowDown",
  despesa: "arrowUp",
  compra_stock: "box",
  transferencia: "home",
  poupanca_deposito: "piggy",
  poupanca_levantamento: "piggy",
  xitique_contribuicao: "circle",
  xitique_recebimento: "circle",
  credito_stock: "truck",
  credito_pagamento: "coins",
  estorno: "sync",
  entrada_capital: "wallet",
  ajuste_stock: "box",
};

type Entry = Snapshot["entries"][number] & { pending?: boolean };

function entryTitle(entry: Entry, snap: Snapshot) {
  const product = snap.products.find((row) => row.id === entry.productId);
  const customer = snap.customers.find((row) => row.id === entry.customerId);
  if (entry.kind === "despesa") return EXPENSE_CATEGORIES.find((row) => row.key === entry.category)?.label ?? "Despesa";
  if (product) return `${entry.quantity ?? ""} ${product.name}`.trim();
  if (customer) return `${ENTRY_LABELS[entry.kind]} · ${customer.name}`;
  return entry.memo || ENTRY_LABELS[entry.kind] || entry.kind;
}

export function EntryRow({ entry, snap, onClick }: { entry: Entry; snap: Snapshot; onClick?: () => void }) {
  const income = INCOME.has(entry.kind);
  return (
    <Row
      icon={ENTRY_ICON[entry.kind] ?? "activity"}
      tone={income ? "in" : entry.kind === "venda_fiado" ? "warn" : "out"}
      title={entryTitle(entry, snap)}
      detail={
        <>
          {formatTime(entry.occurredAt)} · {ENTRY_LABELS[entry.kind]}
          {entry.channel === "voz" ? " · voz" : entry.channel === "agente" ? " · agente" : entry.channel === "whatsapp" ? " · WhatsApp" : ""}
          {entry.pending ? " · por sincronizar" : ""}
          {entry.reversesId ? " · corrigido" : ""}
        </>
      }
      value={<Money cents={income || entry.kind === "venda_fiado" ? entry.amountCents : -entry.amountCents} sign className={income ? "m-in" : ""} />}
      onClick={onClick}
    />
  );
}

const QUICK: { kind: RecordKind; label: string; icon: IconName }[] = [
  { kind: "venda", label: "Vendi", icon: "arrowDown" },
  { kind: "despesa", label: "Gastei", icon: "arrowUp" },
  { kind: "compra", label: "Comprei stock", icon: "box" },
  { kind: "casa", label: "Para casa", icon: "home" },
  { kind: "fiado_recebido", label: "Pagaram-me", icon: "users" },
  { kind: "poupanca", label: "Guardei", icon: "piggy" },
];

export function HomeScreen({ openRecord }: { openRecord: (kind: RecordKind) => void }) {
  const { snap, navigate } = useStore();
  if (!snap?.owner) return <Empty title="A abrir o teu negócio…" icon="sync" />;
  const today = snap.daily.find((row) => row.day === maputoDay()) ?? { salesCents: 0, expensesCents: 0, purchasesCents: 0 };
  const left = today.salesCents - today.expensesCents;
  const nextRing = snap.trust.rings.find((ring) => !ring.done);
  const lowStock = snap.products.filter((row) => row.quantity <= row.lowStockAt);
  const owing = snap.customers.filter((row) => row.owedCents > 0);
  const xitiqueDue = snap.xitique.find((group) => group.nextDue && group.nextDue.status !== "declarada");
  const rejectedDoc = snap.documents.find((doc) => doc.status === "rejeitado");
  const offer = snap.credit.applications.find((row) => row.status === "aprovado");
  const delivery = snap.credit.contracts.find((row) => row.deliveryCode);
  const alerts: { icon: IconName; title: string; detail: string; to: string; tone?: "warn" }[] = [];
  if (snap.conflicts.length) alerts.push({ icon: "flag", title: `${snap.conflicts.length} registos por confirmar`, detail: "Vê se estão certos.", to: "/app/rever", tone: "warn" });
  if (offer) alerts.push({ icon: "coins", title: "Tens uma proposta de crédito", detail: `${offer.supplierName} · ${formatMT(offer.offeredCents ?? 0)}`, to: "/app/credito" });
  if (delivery) alerts.push({ icon: "truck", title: `Código de entrega: ${delivery.deliveryCode}`, detail: `Dá este código ao ${delivery.supplierName} quando receberes o stock.`, to: "/app/credito" });
  if (xitiqueDue?.nextDue) alerts.push({ icon: "circle", title: `${xitiqueDue.name}: ${formatMT(xitiqueDue.nextDue.amountCents)}`, detail: xitiqueDue.nextDue.late ? "Contribuição em atraso" : `Até ${formatShortDay(xitiqueDue.nextDue.dueDate)}`, to: "/app/xitique", tone: xitiqueDue.nextDue.late ? "warn" : undefined });
  if (lowStock[0]) alerts.push({ icon: "box", title: `${lowStock[0].name} a acabar`, detail: `Restam ${lowStock[0].quantity} ${lowStock[0].unit}${lowStock.length > 1 ? ` · e mais ${lowStock.length - 1}` : ""}`, to: "/app/negocio" });
  if (rejectedDoc) alerts.push({ icon: "document", title: "Precisamos de outra fotografia", detail: "O teu agente pode ajudar.", to: "/app/documentos", tone: "warn" });
  if (owing.length) alerts.push({ icon: "users", title: `Devem-te ${formatMT(owing.reduce((sum, row) => sum + row.owedCents, 0))}`, detail: `${owing.length} ${owing.length === 1 ? "cliente" : "clientes"} com fiado`, to: "/app/negocio?fiado" });

  const week = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(maputoDay(), index - 6);
    const row = snap.daily.find((item) => item.day === day);
    return { day, sales: row?.salesCents ?? 0 };
  });
  const top = Math.max(...week.map((row) => row.sales), 1);

  return (
    <section className="m-screen">
      <header className="m-hello">
        <div>
          <p className="muted small">{greeting()},</p>
          <h1>{snap.owner.displayName.split(" ")[0]}</h1>
        </div>
        <button className="m-icon-btn" type="button" aria-label="Avisos" onClick={() => navigate("/app/avisos")}>
          <Icon name="bell" size={21} />
          {snap.unreadNotifications ? <span className="m-dot num">{snap.unreadNotifications}</span> : null}
        </button>
      </header>

      <Card tone="night" className="m-balance">
        <span className="m-balance-label">Bolso do negócio</span>
        <strong className="m-balance-value">
          <Money cents={snap.pockets.negocio} />
        </strong>
        <div className="m-balance-pockets">
          {(["casa", "poupanca", "xitique"] as const).map((pocket) => (
            <button key={pocket} type="button" onClick={() => navigate("/app/bolsos")}>
              <span>{POCKET_LABELS[pocket]}</span>
              <Money cents={snap.pockets[pocket]} />
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="row-between">
          <strong>Hoje</strong>
          <Speak text={`Hoje vendeste ${formatMT(today.salesCents)} e gastaste ${formatMT(today.expensesCents)}.`} />
        </div>
        <div className="m-today">
          <div>
            <span>Vendeste</span>
            <Money cents={today.salesCents} className="m-in" />
          </div>
          <div>
            <span>Gastaste</span>
            <Money cents={today.expensesCents} />
          </div>
          <div>
            <span>{left >= 0 ? "Sobrou" : "Faltou"}</span>
            <Money cents={Math.abs(left)} />
          </div>
        </div>
        <div className="m-week" aria-label="Vendas dos últimos 7 dias">
          {week.map((row) => (
            <div key={row.day} title={`${formatShortDay(row.day)}: ${formatMT(row.sales)}`}>
              <span style={{ height: `${Math.max(4, (row.sales / top) * 100)}%` }} data-today={row.day === maputoDay()} />
              <small>{formatShortDay(row.day).split(" ")[0]}</small>
            </div>
          ))}
        </div>
      </Card>

      <div className="m-quick">
        {QUICK.map((item) => (
          <button key={item.kind} type="button" onClick={() => openRecord(item.kind)}>
            <Icon name={item.icon} size={22} />
            {item.label}
          </button>
        ))}
      </div>

      {alerts.length ? (
        <div className="m-list">
          {alerts.slice(0, 5).map((alert) => (
            <Row key={alert.title} icon={alert.icon} tone={alert.tone} title={alert.title} detail={alert.detail} onClick={() => navigate(alert.to)} value={<Icon name="chevron" size={18} />} />
          ))}
        </div>
      ) : null}

      <button type="button" className="m-card m-ring-card" onClick={() => navigate("/app/historial")}>
        <Rings ring={snap.trust.ring} size={86} />
        <span className="grow" style={{ textAlign: "left" }}>
          <span className="muted small">Anel {snap.trust.ring} de 4</span>
          <strong>{["Caixa", "Poupança", "Xitique", "Crédito"][snap.trust.ring - 1]}</strong>
          <span className="small">{nextRing?.missing[0] ?? "Tens historial para pedir crédito a um fornecedor."}</span>
        </span>
        <Icon name="chevron" size={18} />
      </button>

      <div className="row-between" style={{ marginTop: 6 }}>
        <h2 className="m-h2">Últimos registos</h2>
        <button type="button" className="link small" onClick={() => navigate("/app/movimentos")}>
          Ver todos
        </button>
      </div>
      <div className="m-list">
        {snap.entries.slice(0, 6).map((entry) => (
          <EntryRow key={entry.id} entry={entry} snap={snap} />
        ))}
        {snap.entries.length === 0 ? <Empty title="Ainda não registaste nada" icon="mic">Toca em Vendi ou fala: “vendi duas caixas por mil”.</Empty> : null}
      </div>
    </section>
  );
}

export function EntriesScreen() {
  const { snap, record } = useStore();
  const [filter, setFilter] = useState<"todos" | "entradas" | "saidas">("todos");
  const [selected, setSelected] = useState<Entry | null>(null);
  const [reason, setReason] = useState("");
  const { busy, run } = useBusy();
  const groups = useMemo(() => {
    const list = (snap?.entries ?? []).filter((entry) => (filter === "todos" ? true : filter === "entradas" ? INCOME.has(entry.kind) : !INCOME.has(entry.kind)));
    const byDay = new Map<string, Entry[]>();
    for (const entry of list) {
      const day = maputoDay(new Date(entry.occurredAt));
      byDay.set(day, [...(byDay.get(day) ?? []), entry]);
    }
    return [...byDay.entries()];
  }, [snap, filter]);
  if (!snap) return null;
  return (
    <Screen title="Movimentos">
      <Chips value={filter} options={[{ value: "todos", label: "Todos" }, { value: "entradas", label: "Entradas" }, { value: "saidas", label: "Saídas" }]} onChange={setFilter} />
      {groups.length === 0 ? <Empty title="Sem movimentos" icon="activity" /> : null}
      {groups.map(([day, entries]) => (
        <div key={day}>
          <h2 className="m-day">{day === maputoDay() ? "Hoje" : formatShortDay(day)}</h2>
          <div className="m-list">
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} snap={snap} onClick={entry.pending || entry.kind === "estorno" || entry.reversesId ? undefined : () => setSelected(entry)} />
            ))}
          </div>
        </div>
      ))}
      <p className="m-note">Nada se apaga. Um erro corrige-se com outro registo, e os dois ficam visíveis.</p>
      <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title="Corrigir registo">
        {selected ? (
          <div className="stack">
            <EntryRow entry={selected} snap={snap} />
            <p className="small muted">A correcção cria um registo ao contrário, com a mesma data. O original continua visível.</p>
            <label className="field">
              <span className="label">Porquê?</span>
              <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Valor errado, registei duas vezes…" />
            </label>
            <button
              className="btn btn-primary btn-full"
              type="button"
              disabled={busy || reason.trim().length < 2}
              onClick={() =>
                run(async () => {
                  await record("entry.reverse", { entryId: selected.id, reason: reason.trim() });
                  setSelected(null);
                  setReason("");
                }, "Corrigido.")
              }
            >
              Corrigir
            </button>
          </div>
        ) : null}
      </Sheet>
    </Screen>
  );
}

export function BusinessScreen() {
  const { snap, record } = useStore();
  const [tab, setTab] = useState<"stock" | "fiado">(() => (typeof window !== "undefined" && window.location.search.includes("fiado") ? "fiado" : "stock"));
  const [sheet, setSheet] = useState<"produto" | "cliente" | "ajuste" | null>(null);
  const [form, setForm] = useState({ id: "", name: "", unit: "unidade", price: "", low: "5", phone: "", quantity: "0" });
  const { busy, run } = useBusy();
  if (!snap) return null;
  const owing = snap.customers.filter((row) => row.owedCents > 0).sort((a, b) => b.owedCents - a.owedCents);
  const settled = snap.customers.filter((row) => row.owedCents <= 0);
  return (
    <Screen
      title="Negócio"
      action={
        <button className="btn btn-primary btn-s" type="button" onClick={() => { setForm({ id: crypto.randomUUID(), name: "", unit: "unidade", price: "", low: "5", phone: "", quantity: "0" }); setSheet(tab === "stock" ? "produto" : "cliente"); }}>
          <Icon name="plus" size={16} /> {tab === "stock" ? "Produto" : "Cliente"}
        </button>
      }
    >
      <Chips value={tab} options={[{ value: "stock", label: "Stock" }, { value: "fiado", label: "Fiado" }]} onChange={setTab} />
      {tab === "stock" ? (
        <>
          <Card tone="soft">
            <div className="row-between">
              <span className="small">Valor do stock (ao custo)</span>
              <Money cents={snap.books.stockValue} />
            </div>
          </Card>
          <div className="m-list">
            {snap.products.length === 0 ? <Empty title="Sem produtos" icon="box">Cria os produtos que vendes para ver o stock e o lucro.</Empty> : null}
            {snap.products.map((product) => (
              <Row
                key={product.id}
                icon="box"
                tone={product.quantity <= product.lowStockAt ? "warn" : undefined}
                title={product.name}
                detail={`${product.quantity} ${product.unit}${product.quantity <= product.lowStockAt ? " · a acabar" : ""}${product.salePriceCents ? ` · vende a ${formatMT(product.salePriceCents)}` : ""}`}
                value={<Icon name="chevron" size={18} />}
                onClick={() => {
                  setForm({ id: product.id, name: product.name, unit: product.unit, price: product.salePriceCents ? String(product.salePriceCents / 100) : "", low: String(product.lowStockAt), phone: "", quantity: String(product.quantity) });
                  setSheet("ajuste");
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <Card tone="soft">
            <div className="row-between">
              <span className="small">Devem-te no total</span>
              <Money cents={owing.reduce((sum, row) => sum + row.owedCents, 0)} />
            </div>
          </Card>
          <div className="m-list">
            {owing.length === 0 ? <Empty title="Ninguém te deve" icon="check" /> : null}
            {owing.map((customer) => (
              <Row key={customer.id} icon="users" tone="warn" title={customer.name} detail={customer.oldestAt ? `Desde ${relativeTime(customer.oldestAt)}` : undefined} value={<Money cents={customer.owedCents} />} />
            ))}
          </div>
          {settled.length ? (
            <>
              <h2 className="m-day">Clientes sem dívida</h2>
              <div className="m-list">
                {settled.map((customer) => (
                  <Row key={customer.id} icon="user" title={customer.name} detail={customer.phone ?? undefined} />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      <Sheet open={sheet === "produto" || sheet === "ajuste"} onClose={() => setSheet(null)} title={sheet === "ajuste" ? form.name : "Novo produto"}>
        <div className="stack">
          <label className="field">
            <span className="label">Nome</span>
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Tomate" />
          </label>
          <div className="row">
            <label className="field grow">
              <span className="label">Unidade</span>
              <input className="input" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="caixa, saco, kg" />
            </label>
            <label className="field grow">
              <span className="label">Preço de venda (MT)</span>
              <input className="input num" inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
            </label>
          </div>
          <div className="row">
            <label className="field grow">
              <span className="label">Avisar quando restarem</span>
              <input className="input num" type="number" min={0} value={form.low} onChange={(event) => setForm({ ...form, low: event.target.value })} />
            </label>
            {sheet === "ajuste" ? (
              <label className="field grow">
                <span className="label">Quantidade que tens</span>
                <input className="input num" type="number" min={0} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
              </label>
            ) : null}
          </div>
          <button
            className="btn btn-primary btn-full"
            type="button"
            disabled={busy || form.name.trim().length < 1}
            onClick={() =>
              run(async () => {
                await record("product.upsert", { id: form.id, name: form.name.trim(), unit: form.unit.trim() || "unidade", salePriceCents: parseAmountToCents(form.price), lowStockAt: Number(form.low) || 0 });
                const current = snap.products.find((row) => row.id === form.id);
                if (sheet === "ajuste" && current && Number(form.quantity) !== current.quantity) {
                  await record("stock.adjust", { productId: form.id, quantity: Math.max(0, Number(form.quantity) || 0), reason: "Contagem do stock" });
                }
                setSheet(null);
              }, "Guardado.")
            }
          >
            Guardar
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === "cliente"} onClose={() => setSheet(null)} title="Novo cliente">
        <div className="stack">
          <label className="field">
            <span className="label">Nome</span>
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Mana Rita" />
          </label>
          <label className="field">
            <span className="label">Telefone (opcional)</span>
            <input className="input num" inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
          <button
            className="btn btn-primary btn-full"
            type="button"
            disabled={busy || form.name.trim().length < 1}
            onClick={() =>
              run(async () => {
                await record("customer.upsert", { id: form.id, name: form.name.trim(), phone: form.phone.trim() || null });
                setSheet(null);
              }, "Cliente criado.")
            }
          >
            Guardar
          </button>
        </div>
      </Sheet>
    </Screen>
  );
}

export function PocketsScreen() {
  const { snap, record } = useStore();
  const [sheet, setSheet] = useState<"transferir" | "levantar" | "meta" | null>(null);
  const [cents, setCents] = useState(0);
  const [direction, setDirection] = useState<"negocio_casa" | "casa_negocio">("negocio_casa");
  const [goal, setGoal] = useState({ name: "", target: "" });
  const { busy, run } = useBusy();
  if (!snap) return null;
  const pockets = [
    { key: "negocio", icon: "wallet", detail: "Vendas, stock e fornecedores" },
    { key: "casa", icon: "home", detail: "Comida, escola, transporte da família" },
    { key: "poupanca", icon: "piggy", detail: "O que estás a guardar" },
    { key: "xitique", icon: "circle", detail: "O que já deste ao grupo, menos o que recebeste" },
  ] as const;
  return (
    <Screen title="Bolsos">
      <p className="m-note">Acompanha o negócio, a casa e a poupança em bolsos separados. Consulta os movimentos para perceberes cada saldo.</p>
      <div className="m-pockets">
        {pockets.map((pocket) => (
          <Card key={pocket.key}>
            <Icon name={pocket.icon} size={20} />
            <span className="small muted">{POCKET_LABELS[pocket.key]}</span>
            <strong className="m-big">
              <Money cents={snap.pockets[pocket.key]} />
            </strong>
            <span className="tiny muted">{pocket.detail}</span>
          </Card>
        ))}
      </div>
      <div className="row wrap">
        <button className="btn btn-primary" type="button" onClick={() => { setCents(0); setSheet("transferir"); }}>
          Mudar de bolso
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => { setCents(0); setSheet("levantar"); }}>
          Tirar da poupança
        </button>
      </div>
      <div className="row-between">
        <h2 className="m-h2">Metas</h2>
        <button className="link small" type="button" onClick={() => setSheet("meta")}>
          Nova meta
        </button>
      </div>
      {snap.goals.length === 0 ? <Empty title="Sem metas" icon="flag">Dá um nome ao que queres conseguir: propinas, arca, chapa.</Empty> : null}
      {snap.goals.map((row) => (
        <Card key={row.id}>
          <div className="row-between">
            <strong>{row.name}</strong>
            <span className="small muted num">
              {formatMT(row.savedCents)} de {formatMT(row.targetCents)}
            </span>
          </div>
          <div className="m-progress">
            <span style={{ width: `${Math.min(100, (row.savedCents / row.targetCents) * 100)}%` }} />
          </div>
        </Card>
      ))}

      <Sheet open={sheet === "transferir"} onClose={() => setSheet(null)} title="Mudar de bolso">
        <Chips value={direction} options={[{ value: "negocio_casa", label: "Negócio → Casa" }, { value: "casa_negocio", label: "Casa → Negócio" }]} onChange={setDirection} />
        <AmountPad cents={cents} onChange={setCents} />
        <button
          className="btn btn-sun btn-full"
          type="button"
          disabled={busy || cents <= 0}
          onClick={() =>
            run(async () => {
              const [from, to] = direction === "negocio_casa" ? ["negocio", "casa"] : ["casa", "negocio"];
              await record("pocket.transfer", { from, to, amountCents: cents });
              setSheet(null);
            }, "Feito.")
          }
        >
          Confirmar {cents > 0 ? formatMT(cents) : ""}
        </button>
      </Sheet>

      <Sheet open={sheet === "levantar"} onClose={() => setSheet(null)} title="Tirar da poupança">
        <AmountPad cents={cents} onChange={setCents} />
        <button
          className="btn btn-primary btn-full"
          type="button"
          disabled={busy || cents <= 0}
          onClick={() =>
            run(async () => {
              await record("savings.withdraw", { amountCents: cents, pocket: "casa" });
              setSheet(null);
            }, "Feito.")
          }
        >
          Passar para a Casa
        </button>
      </Sheet>

      <Sheet open={sheet === "meta"} onClose={() => setSheet(null)} title="Nova meta">
        <div className="stack">
          <label className="field">
            <span className="label">Para quê?</span>
            <input className="input" value={goal.name} onChange={(event) => setGoal({ ...goal, name: event.target.value })} placeholder="Propinas da escola" />
          </label>
          <label className="field">
            <span className="label">Quanto queres juntar (MT)</span>
            <input className="input num" inputMode="decimal" value={goal.target} onChange={(event) => setGoal({ ...goal, target: event.target.value })} />
          </label>
          <button
            className="btn btn-primary btn-full"
            type="button"
            disabled={busy || !goal.name.trim() || !parseAmountToCents(goal.target)}
            onClick={() =>
              run(async () => {
                await record("savings.goal", { id: crypto.randomUUID(), name: goal.name.trim(), targetCents: parseAmountToCents(goal.target) });
                setGoal({ name: "", target: "" });
                setSheet(null);
              }, "Meta criada.")
            }
          >
            Criar meta
          </button>
        </div>
      </Sheet>
    </Screen>
  );
}
