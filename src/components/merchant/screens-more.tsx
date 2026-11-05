"use client";

import { useEffect, useRef, useState } from "react";
import { Rings, XitiqueCircle } from "@/components/brand";
import { Icon, type IconName } from "@/components/icon";
import { addDays, formatDateTime, formatDay, formatShortDay, maputoDay, relativeTime } from "@/lib/dates";
import { interpret } from "@/lib/interpret";
import { APPLICATION_LABELS, CONFLICT_LABELS, CONSENT_PURPOSES, CONTRACT_LABELS, CONTRIBUTION_LABELS, DOCUMENT_STATUS_LABELS, DOCUMENT_TYPES, KYC_LEVEL_LABELS, PASSPORT_SECTIONS, REJECTION_REASONS } from "@/lib/labels";
import { formatMT, parseAmountToCents } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { Card, Chips, Empty, Money, Row, Screen, Sheet, Speak, useBusy } from "./kit";
import { useStore } from "./store";

const READINESS: Record<string, string> = { a_comecar: "A começar", a_crescer: "A crescer", quase: "Quase lá", pronto_para_revisao: "Pronto para revisão" };

export function MoreScreen() {
  const { navigate, snap } = useStore();
  const items: { to: string; icon: IconName; title: string; detail: string }[] = [
    { to: "/app/bolsos", icon: "wallet", title: "Bolsos e poupança", detail: "Negócio, Casa, Poupança, metas" },
    { to: "/app/xitique", icon: "circle", title: "Xitique", detail: snap?.xitique.length ? `${snap.xitique.length} ${snap.xitique.length === 1 ? "grupo" : "grupos"}` : "Cria ou entra num grupo" },
    { to: "/app/credito", icon: "coins", title: "Crédito fornecedor", detail: "Stock agora, pagar depois das vendas" },
    { to: "/app/historial", icon: "ring", title: "Historial e passaporte", detail: "Os teus anéis e o que podes partilhar" },
    { to: "/app/documentos", icon: "document", title: "Documentos", detail: KYC_LEVEL_LABELS[snap?.kyc.level ?? 0] },
    { to: "/app/assistente", icon: "chat", title: "Assistente", detail: "Pergunta ou regista a falar" },
    { to: "/app/avisos", icon: "bell", title: "Avisos", detail: snap?.unreadNotifications ? `${snap.unreadNotifications} por ler` : "Mensagens do Ukuphila" },
    { to: "/app/privacidade", icon: "eye", title: "Privacidade", detail: "Quem viu os meus dados, consentimentos" },
    { to: "/app/perfil", icon: "user", title: "Perfil e PIN", detail: "O teu agente, a tua conta" },
  ];
  return (
    <Screen title="Mais">
      <div className="m-list">
        {items.map((item) => (
          <Row key={item.to} icon={item.icon} title={item.title} detail={item.detail} value={<Icon name="chevron" size={18} />} onClick={() => navigate(item.to)} />
        ))}
      </div>
    </Screen>
  );
}

type GroupDetail = {
  group: { id: string; name: string; code: string; status: string; payoutMode: string; drawCommit: string | null; drawSeed: string | null; contributionCents: number; frequency: string; rules: string | null };
  members: { id: string; displayName: string; userId: string | null; position: number | null; role: string }[];
  rounds: { id: string; number: number; dueDate: string; status: string; recipientMemberId: string; recipientName: string; contributions: { id: string; memberId: string; memberName: string; status: string; declaredBy: string | null; canConfirm: boolean }[] }[];
  currentRound: { id: string } | null;
  myMember: { id: string; role: string } | null;
  potCents: number;
  events: { id: string; summary: string; createdAt: string }[];
};

export function XitiqueScreen({ groupId }: { groupId?: string }) {
  const { snap, call, record, navigate, refresh } = useStore();
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [sheet, setSheet] = useState<"criar" | "entrar" | "membro" | null>(null);
  const [form, setForm] = useState({ name: "", amount: "", frequency: "semanal", mode: "combinada", code: "", member: "", phone: "", start: maputoDay(), receipt: "" });
  const { busy, run } = useBusy();

  const load = async () => {
    if (!groupId) return;
    try {
      const loaded = await call<GroupDetail>("xitique.detail", { groupId });
      setDetail(loaded);
      setOrder((previous) => [...previous.filter((id) => loaded.members.some((member) => member.id === id)), ...loaded.members.map((member) => member.id).filter((id) => !previous.includes(id))]);
    } catch {
      setDetail(null);
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  if (!snap) return null;

  if (groupId) {
    if (!detail) return <Screen title="Xitique" back="/app/xitique"><Empty title="A abrir o grupo…" icon="circle">O detalhe do grupo precisa de rede.</Empty></Screen>;
    const current = detail.rounds.find((round) => round.status !== "paga");
    const isManager = detail.myMember?.role === "tesoureiro";
    const states = detail.members.map((member) => {
      const contribution = current?.contributions.find((row) => row.memberId === member.id);
      return { name: member.displayName, state: (contribution?.status ?? "pendente") as "confirmada" | "declarada" | "pendente" | "atrasada" };
    });
    const recipientIndex = current ? detail.members.findIndex((member) => member.id === current.recipientMemberId) : -1;
    const mine = current?.contributions.find((row) => row.memberId === detail.myMember?.id);
    const recipient = current ? detail.members.find((member) => member.id === current.recipientMemberId) : null;
    const fullyConfirmed = Boolean(current?.contributions.length && current.contributions.every((row) => row.status === "confirmada"));
    return (
      <Screen title={detail.group.name} back="/app/xitique">
        <Card tone="night">
          <div className="row-between">
            <div>
              <span className="small">Pote por ronda</span>
              <strong className="m-big">
                <Money cents={detail.potCents} />
              </strong>
              <span className="tiny">
                {formatMT(detail.group.contributionCents)} · {detail.group.frequency} · código <strong className="mono">{detail.group.code}</strong>
              </span>
            </div>
          </div>
        </Card>
        {detail.group.status === "formacao" ? (
          <Card>
            <strong>O grupo está a formar-se</strong>
            <p className="small muted">Partilha o código {detail.group.code}. {detail.group.payoutMode === "sorteio" ? `O sorteio já está selado: ${detail.group.drawCommit?.slice(0, 12)}…` : "Combina a ordem com o grupo antes de começar."}</p>
            {isManager ? (
              <div className="stack" style={{ marginTop: 10 }}>
                <button className="btn btn-ghost btn-s" type="button" onClick={() => setSheet("membro")}>
                  Acrescentar membro sem telefone
                </button>
                <label className="field">
                  <span className="label">Primeira ronda</span>
                  <input className="input" type="date" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} />
                </label>
                {detail.group.payoutMode === "combinada" ? <fieldset className="stack" style={{ border: 0, padding: 0 }}><legend className="label">Ordem de recebimento</legend>{order.map((id, index) => <div className="row-between" key={id}><span className="small">{index + 1}. {detail.members.find((member) => member.id === id)?.displayName}</span><div className="row"><button className="btn btn-ghost btn-s" type="button" disabled={index === 0 || busy} aria-label={`Subir ${detail.members.find((member) => member.id === id)?.displayName}`} onClick={() => setOrder((previous) => { const next = [...previous]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>↑</button><button className="btn btn-ghost btn-s" type="button" disabled={index === order.length - 1 || busy} aria-label={`Descer ${detail.members.find((member) => member.id === id)?.displayName}`} onClick={() => setOrder((previous) => { const next = [...previous]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })}>↓</button></div></div>)}</fieldset> : null}
                <button className="btn btn-primary" type="button" disabled={busy || detail.members.length < 3} onClick={() => run(async () => { await call("xitique.start", { groupId: detail.group.id, startsOn: form.start, ...(detail.group.payoutMode === "combinada" ? { order } : {}) }); await load(); await refresh(); }, "O grupo começou.")}>
                  Começar o grupo ({detail.members.length} pessoas)
                </button>
              </div>
            ) : null}
          </Card>
        ) : null}
        {current ? (
          <Card>
            <div className="row-between">
              <strong>Ronda {current.number}</strong>
              <span className="small muted">até {formatShortDay(current.dueDate)}</span>
            </div>
            <p className="small">Recebe: <strong>{current.recipientName}</strong></p>
            <div style={{ display: "grid", placeItems: "center" }}>
              <XitiqueCircle members={states} recipient={recipientIndex} size={260} />
            </div>
            <div className="m-list">
              {current.contributions.map((row) => {
                const canConfirm = row.canConfirm;
                const canDeclareFor = isManager && row.status !== "declarada" && row.status !== "confirmada" && !detail.members.find((member) => member.id === row.memberId)?.userId;
                return (
                  <Row
                    key={row.id}
                    icon="user"
                    title={row.memberName}
                    detail={CONTRIBUTION_LABELS[row.status]}
                    tone={row.status === "confirmada" ? "in" : row.status === "atrasada" ? "warn" : undefined}
                    value={
                      canConfirm ? (
                        <button className="btn btn-primary btn-s" type="button" disabled={busy} onClick={() => run(async () => { await call("xitique.confirm", { contributionId: row.id }); await load(); }, "Confirmado.")}>
                          Confirmar
                        </button>
                      ) : canDeclareFor ? (
                        <button className="btn btn-ghost btn-s" type="button" disabled={busy} onClick={() => run(async () => { await record("xitique.declare", { contributionId: row.id }); setTimeout(load, 1500); }, "Declarado.")}>
                          Pagou
                        </button>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
            {mine && (mine.status === "pendente" || mine.status === "atrasada") ? (
              <button className="btn btn-sun btn-full" type="button" disabled={busy} onClick={() => run(async () => { await record("xitique.declare", { contributionId: mine.id }); setTimeout(load, 1500); }, "Declarado. Falta outra pessoa confirmar.")}>
                Já paguei {formatMT(detail.group.contributionCents)}
              </button>
            ) : null}
            {current.recipientMemberId === detail.myMember?.id ? (
              <button className="btn btn-primary btn-full" type="button" disabled={busy || !fullyConfirmed} onClick={() => run(async () => { await call("xitique.payout", { roundId: current.id }); await load(); await refresh(); }, "Recebimento registado.")}>
                Confirmo que recebi o pote
              </button>
            ) : null}
            {recipient && !recipient.userId && isManager ? <div className="stack"><label className="field"><span className="label">Entrega a {recipient.displayName}</span><textarea className="textarea" value={form.receipt} minLength={10} maxLength={4000} onChange={(event) => setForm({ ...form, receipt: event.target.value })} placeholder="Regista a data, a pessoa que recebeu e como foi feita a entrega." /></label><button className="btn btn-primary btn-full" type="button" disabled={busy || !fullyConfirmed || form.receipt.trim().length < 10} onClick={() => run(async () => { await call("xitique.payout", { roundId: current.id, receiptNote: form.receipt }); setForm({ ...form, receipt: "" }); await load(); await refresh(); }, "Entrega registada no histórico do grupo.")}>Registar entrega a {recipient.displayName}</button></div> : null}
            {!fullyConfirmed ? <p className="hint">Falta confirmar contribuições antes de registar a entrega do pote.</p> : null}
          </Card>
        ) : null}
        <h2 className="m-h2">Ordem</h2>
        <div className="m-list">
          {detail.rounds.map((round) => (
            <Row key={round.id} icon="circle" title={`${round.number}. ${round.recipientName}`} detail={formatDay(round.dueDate)} tone={round.status === "paga" ? "in" : undefined} value={round.status === "paga" ? <Icon name="check" size={18} /> : undefined} />
          ))}
        </div>
        {detail.group.payoutMode === "sorteio" && detail.group.drawSeed ? (
          <p className="m-note">Sorteio verificável: compromisso {detail.group.drawCommit?.slice(0, 16)}…, semente {detail.group.drawSeed}. Qualquer membro pode refazer a conta.</p>
        ) : null}
        <h2 className="m-h2">O que mudou no grupo</h2>
        <div className="m-list">
          {detail.events.map((event) => (
            <Row key={event.id} icon="activity" title={event.summary} detail={relativeTime(event.createdAt)} />
          ))}
        </div>
        <Sheet open={sheet === "membro"} onClose={() => setSheet(null)} title="Membro sem telefone">
          <div className="stack">
            <label className="field">
              <span className="label">Nome</span>
              <input className="input" value={form.member} onChange={(event) => setForm({ ...form, member: event.target.value })} />
            </label>
            <button className="btn btn-primary btn-full" type="button" disabled={busy || form.member.trim().length < 2} onClick={() => run(async () => { await call("xitique.member", { groupId: detail.group.id, name: form.member.trim() }); setSheet(null); await load(); }, "Membro acrescentado.")}>
              Acrescentar
            </button>
          </div>
        </Sheet>
      </Screen>
    );
  }

  return (
    <Screen title="Xitique">
      <p className="m-note">O grupo continua a ser vosso. O Ukuphila guarda quem pagou, quem recebe e o que mudou, e cada pagamento é confirmado por outra pessoa.</p>
      {snap.xitique.length === 0 ? <Empty title="Ainda não estás em nenhum grupo" icon="circle" /> : null}
      {snap.xitique.map((group) => (
        <button key={group.id} type="button" className="m-card m-group" onClick={() => navigate(`/app/xitique/${group.id}`)}>
          <div className="row-between">
            <strong>{group.name}</strong>
            <Icon name="chevron" size={18} />
          </div>
          <span className="small muted">
            {group.members} pessoas · {formatMT(group.contributionCents)} {group.frequency}
          </span>
          {group.currentRound ? <span className="small">Ronda {group.currentRound.number} de {group.rounds}: recebe {group.currentRound.isMine ? "tu" : group.currentRound.recipientName}</span> : <span className="small">Em formação · código {group.code}</span>}
          {group.nextDue ? <span className="small" data-tone={group.nextDue.late ? "warn" : undefined}>{group.nextDue.status === "declarada" ? "À espera de confirmação" : `Falta pagares ${formatMT(group.nextDue.amountCents)} até ${formatShortDay(group.nextDue.dueDate)}`}</span> : null}
          <span className="tiny muted">Pagaste {group.paidOnTime} de {group.paidTotal} a tempo</span>
        </button>
      ))}
      <div className="row wrap">
        <button className="btn btn-primary" type="button" onClick={() => setSheet("criar")}>
          Criar grupo
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => setSheet("entrar")}>
          Entrar com código
        </button>
      </div>
      <Sheet open={sheet === "criar"} onClose={() => setSheet(null)} title="Novo Xitique">
        <div className="stack">
          <label className="field">
            <span className="label">Nome do grupo</span>
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="field">
            <span className="label">Contribuição por pessoa (MT)</span>
            <input className="input num" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </label>
          <Chips value={form.frequency} options={[{ value: "semanal", label: "Semanal" }, { value: "quinzenal", label: "Quinzenal" }, { value: "mensal", label: "Mensal" }]} onChange={(frequency) => setForm({ ...form, frequency })} />
          <Chips value={form.mode} options={[{ value: "combinada", label: "Ordem combinada" }, { value: "sorteio", label: "Sorteio" }]} onChange={(mode) => setForm({ ...form, mode })} />
          <button
            className="btn btn-primary btn-full"
            type="button"
            disabled={busy || form.name.trim().length < 2 || !parseAmountToCents(form.amount)}
            onClick={() =>
              run(async () => {
                const result = await call<{ groupId: string; code: string }>("xitique.create", { name: form.name.trim(), contributionCents: parseAmountToCents(form.amount), frequency: form.frequency, payoutMode: form.mode });
                setSheet(null);
                await refresh();
                navigate(`/app/xitique/${result.groupId}`);
              }, "Grupo criado. Partilha o código com as outras pessoas.")
            }
          >
            Criar
          </button>
        </div>
      </Sheet>
      <Sheet open={sheet === "entrar"} onClose={() => setSheet(null)} title="Entrar num grupo">
        <div className="stack">
          <label className="field">
            <span className="label">Código</span>
            <input className="input mono" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="UKU-XXXXX" />
          </label>
          <button className="btn btn-primary btn-full" type="button" disabled={busy || form.code.length < 4} onClick={() => run(async () => { const result = await call<{ groupId: string }>("xitique.join", { code: form.code }); setSheet(null); await refresh(); navigate(`/app/xitique/${result.groupId}`); }, "Entraste no grupo.")}>
            Entrar
          </button>
        </div>
      </Sheet>
    </Screen>
  );
}

export function CreditScreen() {
  const { snap, call, refresh } = useStore();
  const [supplierId, setSupplierId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [offer, setOffer] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const { busy, run } = useBusy();
  if (!snap) return null;
  const ring4 = snap.trust.rings[3];
  const ready = snap.trust.ring === 4;
  const supplier = snap.credit.suppliers.find((row) => row.id === supplierId);
  const total = supplier ? supplier.products.reduce((sum, product) => sum + (quantities[product.id] ?? 0) * product.priceCents, 0) : 0;
  const active = snap.credit.contracts.filter((row) => ["aguarda_entrega", "activo", "em_atraso", "incumprimento"].includes(row.status));
  const open = snap.credit.applications.find((row) => ["submetido", "em_analise", "recomendado", "aprovado"].includes(row.status));
  const consent = snap.consents.some((row) => row.purpose === "historial_credito" && row.status === "concedido");
  const proposal = snap.credit.applications.find((row) => row.id === offer);
  return (
    <Screen title="Crédito fornecedor">
      <p className="m-note">Stock do fornecedor para pagares depois das vendas. Não é um direito automático: duas pessoas da equipa decidem, e tu aceitas com o teu PIN.</p>
      {active.map((contract) => {
        const paid = contract.instalments.reduce((sum, row) => sum + row.paidCents, 0);
        const due = contract.principalCents + contract.feeCents;
        return (
          <Card key={contract.id} tone={contract.status === "em_atraso" || contract.status === "incumprimento" ? "sun" : undefined}>
            <div className="row-between">
              <strong>{contract.supplierName}</strong>
              <span className="small">{CONTRACT_LABELS[contract.status]}</span>
            </div>
            {contract.deliveryCode ? (
              <div className="m-code">
                <span className="small">Código de entrega</span>
                <strong className="num">{contract.deliveryCode}</strong>
                <span className="tiny muted">Dá este código ao fornecedor só quando receberes o stock.</span>
              </div>
            ) : (
              <>
                <div className="m-progress">
                  <span style={{ width: `${Math.min(100, (paid / due) * 100)}%` }} />
                </div>
                <p className="small num">
                  Pagaste {formatMT(paid)} de {formatMT(due)}
                </p>
                <div className="m-list">
                  {contract.instalments.map((row) => (
                    <Row key={row.number} icon="coins" title={`Prestação ${row.number}`} detail={formatDay(row.dueDate)} tone={row.status === "pago" ? "in" : row.status === "em_atraso" ? "warn" : undefined} value={<Money cents={row.amountCents} />} />
                  ))}
                </div>
                <p className="tiny muted">Pagas através do teu agente. Cada pagamento fica no teu historial.</p>
              </>
            )}
          </Card>
        );
      })}
      {open ? (
        <Card tone={open.status === "aprovado" ? "sun" : "soft"}>
          <div className="row-between">
            <strong>Pedido {open.code}</strong>
            <span className="small">{APPLICATION_LABELS[open.status]}</span>
          </div>
          <p className="small">{open.supplierName} · {formatMT(open.requestedCents)}</p>
          {open.status === "aprovado" ? (
            <button className="btn btn-sun btn-full" type="button" onClick={() => setOffer(open.id)}>
              Ver a proposta
            </button>
          ) : (
            <p className="tiny muted">Uma pessoa da equipa está a analisar. Recebes um aviso.</p>
          )}
        </Card>
      ) : null}
      {!open && active.length === 0 ? (
        ready ? (
          consent ? (
            <Card>
              <strong>Fazer um pedido</strong>
              <Chips value={supplierId} options={snap.credit.suppliers.map((row) => ({ value: row.id, label: row.name }))} onChange={(value) => { setSupplierId(value); setQuantities({}); }} />
              {supplier ? (
                <div className="m-list">
                  {supplier.products.map((product) => (
                    <div key={product.id} className="m-row">
                      <span className="m-row-text">
                        <span className="m-row-title">{product.name}</span>
                        <span className="m-row-detail">{formatMT(product.priceCents)} por {product.unit}</span>
                      </span>
                      <input className="input num" style={{ width: 84 }} type="number" min={0} value={quantities[product.id] ?? 0} onChange={(event) => setQuantities({ ...quantities, [product.id]: Math.max(0, Number(event.target.value) || 0) })} aria-label={`Quantidade de ${product.name}`} />
                    </div>
                  ))}
                </div>
              ) : null}
              {snap.credit.suppliers.length === 0 ? <p className="small muted">Ainda não há fornecedores parceiros activos.</p> : null}
              <button
                className="btn btn-primary btn-full"
                type="button"
                disabled={busy || total <= 0}
                onClick={() => run(async () => { await call("credit.apply", { supplierId, items: Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([supplierProductId, quantity]) => ({ supplierProductId, quantity })) }); await refresh(); }, "Pedido enviado.")}
              >
                Pedir {total > 0 ? formatMT(total) : ""}
              </button>
            </Card>
          ) : (
            <Card tone="soft">
              <strong>Falta a tua autorização</strong>
              <p className="small">Para pedir crédito, a equipa precisa de ver os teus sinais de confiança. Autoriza em Privacidade.</p>
            </Card>
          )
        ) : (
          <Card>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <Rings ring={snap.trust.ring} size={72} />
              <div className="grow">
                <strong>Ainda não chegaste ao anel do crédito</strong>
                <ul className="m-steps">
                  {ring4.missing.slice(0, 4).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )
      ) : null}
      <Sheet open={Boolean(proposal)} onClose={() => setOffer(null)} title="A proposta">
        {proposal ? (
          <div className="stack">
            <dl className="kv">
              <div>
                <dt>Stock</dt>
                <dd>{proposal.items.map((item) => `${item.quantity} ${item.unit} de ${item.name}`).join(", ")}</dd>
              </div>
              <div>
                <dt>Valor do stock</dt>
                <dd className="num">{formatMT(proposal.offeredCents ?? 0)}</dd>
              </div>
              <div>
                <dt>Custo do crédito</dt>
                <dd className="num">{formatMT(proposal.offeredFeeCents ?? 0)}</dd>
              </div>
              <div>
                <dt>Total a pagar</dt>
                <dd className="num">{formatMT((proposal.offeredCents ?? 0) + (proposal.offeredFeeCents ?? 0))}</dd>
              </div>
              <div>
                <dt>Prazo</dt>
                <dd>
                  {proposal.offeredTermDays} dias, em {proposal.offeredInstalments} {proposal.offeredInstalments === 1 ? "prestação" : "prestações"}
                </dd>
              </div>
            </dl>
            <Speak text={`Vais receber stock de ${formatMT(proposal.offeredCents ?? 0)} e pagar no total ${formatMT((proposal.offeredCents ?? 0) + (proposal.offeredFeeCents ?? 0))} em ${proposal.offeredTermDays} dias.`} />
            <p className="small muted">A dívida só começa quando receberes o stock e deres o código de entrega ao fornecedor.</p>
            <label className="field">
              <span className="label">O teu PIN, para aceitar</span>
              <input className="input num" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value)} />
            </label>
            <button className="btn btn-sun btn-full" type="button" disabled={busy || pin.length < 4} onClick={() => run(async () => { await call("credit.accept", { applicationId: proposal.id, pin }); setOffer(null); setPin(""); await refresh(); }, "Aceite. Guarda o código de entrega.")}>
              Aceito estas condições
            </button>
            <button className="btn btn-ghost btn-full" type="button" disabled={busy} onClick={() => run(async () => { await call("credit.decline", { applicationId: proposal.id }); setOffer(null); await refresh(); }, "Proposta recusada.")}>
              Não quero
            </button>
          </div>
        ) : null}
      </Sheet>
    </Screen>
  );
}

export function HistoryScreen() {
  const { snap, call, refresh } = useStore();
  const [sheet, setSheet] = useState(false);
  const [audience, setAudience] = useState("");
  const [scope, setScope] = useState<string[]>(["identidade", "actividade", "volume", "xitique"]);
  const [days, setDays] = useState(30);
  const [issued, setIssued] = useState<string | null>(null);
  const { busy, run } = useBusy();
  if (!snap) return null;
  const { trust } = snap;
  return (
    <Screen title="Historial">
      <Card tone="night" className="m-rings-hero">
        <Rings ring={trust.ring} size={150} tone="night" />
        <div>
          <span className="small">Anel {trust.ring} de 4</span>
          <strong className="m-big">{READINESS[trust.readiness]}</strong>
          <span className="tiny">Isto ajuda uma pessoa a decidir. Não é uma aprovação automática.</span>
        </div>
      </Card>
      <div className="m-list">
        {trust.rings.map((ring) => (
          <Row key={ring.ring} icon={ring.done ? "check" : "ring"} tone={ring.done ? "in" : undefined} title={`${ring.ring}. ${ring.name}`} detail={ring.done ? "Conseguido" : ring.missing[0]} />
        ))}
      </div>
      <h2 className="m-h2">O que conta</h2>
      <div className="m-list">
        {trust.signals.map((signal) => (
          <Row key={signal.key} icon={signal.state === "forte" ? "check" : signal.state === "fraco" ? "alert" : "activity"} tone={signal.state === "forte" ? "in" : signal.state === "fraco" ? "warn" : undefined} title={signal.label} detail={signal.evidence} />
        ))}
      </div>
      <p className="m-note">Idade, sexo, religião e o tempo que passas na aplicação não entram nestas contas.</p>
      <div className="row-between">
        <h2 className="m-h2">Passaportes</h2>
        <button className="btn btn-primary btn-s" type="button" onClick={() => { setIssued(null); setSheet(true); }}>
          Criar passaporte
        </button>
      </div>
      {snap.passports.length === 0 ? <Empty title="Ainda não partilhaste o teu historial" icon="qr" /> : null}
      <div className="m-list">
        {snap.passports.map((passport) => {
          const alive = !passport.revokedAt && new Date(passport.expiresAt).getTime() > Date.now();
          return (
            <Row
              key={passport.id}
              icon="qr"
              title={passport.audience}
              detail={`${passport.code} · ${alive ? `válido até ${formatDay(passport.expiresAt)}` : passport.revokedAt ? "cancelado" : "expirou"} · visto ${passport.views} vezes`}
              value={alive ? <button className="btn btn-ghost btn-s" type="button" disabled={busy} onClick={() => run(async () => { await call("passport.revoke", { passportId: passport.id }); await refresh(); }, "Cancelado.")}>Cancelar</button> : undefined}
            />
          );
        })}
      </div>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Novo passaporte">
        {issued ? (
          <div className="stack">
            <p>Mostra este código ou partilha o link:</p>
            <strong className="m-code-big mono">{issued}</strong>
            <p className="small">{typeof window !== "undefined" ? `${window.location.origin}/h/${issued}` : ""}</p>
            <button
              className="btn btn-primary btn-full"
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/h/${issued}`;
                if (navigator.share) void navigator.share({ title: "Passaporte do negócio", url });
                else void navigator.clipboard?.writeText(url);
              }}
            >
              Partilhar
            </button>
          </div>
        ) : (
          <div className="stack">
            <label className="field">
              <span className="label">Para quem?</span>
              <input className="input" value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Fornecedor, banco, associação…" />
            </label>
            <span className="label">O que mostrar</span>
            {Object.entries(PASSPORT_SECTIONS).map(([key, section]) => (
              <label key={key} className="check">
                <input type="checkbox" checked={scope.includes(key)} onChange={(event) => setScope(event.target.checked ? [...scope, key] : scope.filter((item) => item !== key))} />
                <span>
                  <strong>{section.label}</strong>
                  <br />
                  <span className="small muted">{section.detail}</span>
                </span>
              </label>
            ))}
            <Chips value={String(days)} options={[{ value: "7", label: "7 dias" }, { value: "30", label: "30 dias" }, { value: "90", label: "90 dias" }]} onChange={(value) => setDays(Number(value))} />
            <button className="btn btn-sun btn-full" type="button" disabled={busy || audience.trim().length < 2 || scope.length === 0} onClick={() => run(async () => { const result = await call<{ code: string }>("passport.issue", { audience: audience.trim(), scope, days }); setIssued(result.code); await refresh(); })}>
              Criar
            </button>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

export function DocumentsScreen() {
  const { snap, refresh, toast } = useStore();
  const [type, setType] = useState("bi");
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  if (!snap) return null;
  const upload = async () => {
    const chosen = file.current?.files?.[0];
    if (!chosen) return toast("Escolhe ou tira a fotografia.");
    setBusy(true);
    try {
      const body = new FormData();
      body.set("type", type);
      body.set("number", number);
      body.set("file", await shrink(chosen));
      const response = await fetch("/api/app/documents", { method: "POST", body });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível enviar.");
      toast("Documento enviado. Uma pessoa da equipa vai rever.");
      setNumber("");
      if (file.current) file.current.value = "";
      await refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Precisas de rede para enviar documentos.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Documentos">
      <Card tone="soft">
        <strong>{KYC_LEVEL_LABELS[snap.kyc.level]}</strong>
        <p className="small">{snap.kyc.level === 0 ? "O teu agente confirma o teu rosto para chegares ao nível 1." : snap.kyc.level === 1 ? "Um documento aprovado leva-te ao nível 2." : "Obrigado. A tua verificação está em dia."}</p>
      </Card>
      <div className="m-list">
        {snap.documents.length === 0 ? <Empty title="Sem documentos" icon="document" /> : null}
        {snap.documents.map((doc) => (
          <Row
            key={doc.id}
            icon="document"
            tone={doc.status === "aprovado" ? "in" : doc.status === "rejeitado" ? "warn" : undefined}
            title={DOCUMENT_TYPES[doc.type] ?? doc.type}
            detail={doc.status === "rejeitado" ? `${REJECTION_REASONS[doc.rejectionReason ?? "outro"]}${doc.rejectionNote ? `. ${doc.rejectionNote}` : ""}` : `${DOCUMENT_STATUS_LABELS[doc.status]}${doc.numberMasked ? ` · ${doc.numberMasked}` : ""}`}
          />
        ))}
      </div>
      <Card>
        <strong>Enviar documento</strong>
        <label className="field">
          <span className="label">Tipo</span>
          <select className="select" value={type} onChange={(event) => setType(event.target.value)}>
            {Object.entries(DOCUMENT_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Número (opcional)</span>
          <input className="input" value={number} onChange={(event) => setNumber(event.target.value)} />
        </label>
        <label className="field">
          <span className="label">Fotografia</span>
          <input ref={file} className="input" type="file" accept="image/*,application/pdf" capture="environment" />
        </label>
        <p className="tiny muted">É cifrado antes de ser guardado. Só a equipa de revisão o pode abrir, e cada abertura aparece em Privacidade.</p>
        <button className="btn btn-primary btn-full" type="button" disabled={busy} onClick={upload}>
          {busy ? "A enviar…" : "Enviar"}
        </button>
      </Card>
    </Screen>
  );
}

/** Phones take 4000 px photos; a 1600 px JPEG is plenty to read a document and fits in 3 MB. */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 900_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.82));
  } catch {
    return file;
  }
}

type Message = { me: boolean; text: string; meta?: string };

export function AssistantScreen() {
  const { online } = useStore();
  const [messages, setMessages] = useState<Message[]>([{ me: false, text: "Olá! Pergunta-me “quanto tenho?”, “como foi hoje?” ou diz o que vendeste. Eu preparo e tu confirmas." }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [messages]);
  const send = async (value: string) => {
    const body = value.trim();
    if (!body) return;
    setMessages((list) => [...list, { me: true, text: body }]);
    setText("");
    if (!online) {
      const parsed = interpret(body);
      setMessages((list) => [...list, { me: false, text: parsed.intent.startsWith("RECORD") ? "Estás sem rede. Usa o botão Registar: o registo fica guardado no telefone." : "Estás sem rede. Respondo quando a ligação voltar." }]);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/app/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: body }) });
      const data = (await response.json()) as { text?: string; error?: string; intent?: string };
      setMessages((list) => [...list, { me: false, text: data.text ?? data.error ?? "Não consegui responder." }]);
    } catch {
      setMessages((list) => [...list, { me: false, text: "Sem ligação. Tenta daqui a pouco." }]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Assistente">
      <div className="m-chat">
        {messages.map((message, index) => (
          <div key={index} className="m-bubble" data-me={message.me}>
            {message.text}
            {!message.me ? <Speak text={message.text} /> : null}
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="m-suggest">
        {["Quanto tenho?", "Como foi hoje?", "Quem me deve?", "O que está a acabar?", "Quanto falta para o Xitique?", "Quero falar com alguém"].map((suggestion) => (
          <button key={suggestion} type="button" className="btn btn-ghost btn-s" onClick={() => send(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
      <form className="m-chat-input" onSubmit={(event) => { event.preventDefault(); void send(text); }}>
        <input className="input" value={text} onChange={(event) => setText(event.target.value)} placeholder="Escreve aqui" aria-label="Mensagem" />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          Enviar
        </button>
      </form>
    </Screen>
  );
}

type Privacy = { viewers: { id: string; name: string; role: string; purpose: string; resource: string; at: string }[]; notifications: { id: string; title: string; body: string; createdAt: string; readAt: string | null }[] };

export function PrivacyScreen() {
  const { snap, call, refresh } = useStore();
  const [data, setData] = useState<Privacy | null>(null);
  const { busy, run } = useBusy();
  useEffect(() => {
    call<Privacy>("privacy.view").then(setData).catch(() => setData(null));
  }, [call]);
  if (!snap) return null;
  const granted = (purpose: string) => snap.consents.some((row) => row.purpose === purpose && row.status === "concedido");
  return (
    <Screen title="Privacidade">
      <h2 className="m-h2">Quem viu os meus dados</h2>
      {!data ? <Empty title="Precisas de rede para ver esta lista" icon="eye" /> : null}
      {data && data.viewers.length === 0 ? <Empty title="Ninguém viu os teus dados" icon="eye" /> : null}
      <div className="m-list">
        {data?.viewers.map((viewer) => (
          <Row key={viewer.id} icon="eye" title={viewer.name} detail={`${viewer.purpose} · ${viewer.resource} · ${formatDateTime(viewer.at)}`} />
        ))}
      </div>
      <h2 className="m-h2">Autorizações</h2>
      <div className="m-list">
        {Object.entries(CONSENT_PURPOSES).map(([key, purpose]) => {
          const on = granted(key);
          return (
            <div key={key} className="m-row">
              <span className="m-row-text">
                <span className="m-row-title">{purpose.label}</span>
                <span className="m-row-detail">{purpose.detail}</span>
              </span>
              {purpose.required ? (
                <span className="tiny muted">Necessário</span>
              ) : (
                <button className={`btn btn-s ${on ? "btn-primary" : "btn-ghost"}`} type="button" disabled={busy} onClick={() => run(async () => { await call("consent.set", { purpose: key, granted: !on }); await refresh(); }, on ? "Autorização retirada." : "Autorizado.")}>
                  {on ? "Autorizado" : "Autorizar"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

export function NoticesScreen() {
  const { call, refresh } = useStore();
  const [data, setData] = useState<Privacy | null>(null);
  useEffect(() => {
    call<Privacy>("privacy.view")
      .then(async (result) => {
        setData(result);
        await call("notifications.read");
        await refresh();
      })
      .catch(() => setData(null));
  }, [call, refresh]);
  return (
    <Screen title="Avisos" back="/app">
      {!data ? <Empty title="Precisas de rede para ver os avisos" icon="bell" /> : null}
      {data && data.notifications.length === 0 ? <Empty title="Sem avisos" icon="bell" /> : null}
      <div className="m-list">
        {data?.notifications.map((notice) => (
          <Row key={notice.id} icon="bell" tone={notice.readAt ? undefined : "warn"} title={notice.title} detail={`${notice.body} · ${relativeTime(notice.createdAt)}`} />
        ))}
      </div>
    </Screen>
  );
}

export function ReviewScreen() {
  const { snap, call, refresh, rejected } = useStore();
  const { busy, run } = useBusy();
  if (!snap) return null;
  return (
    <Screen title="Por confirmar" back="/app">
      <p className="m-note">Nada do que registaste se perdeu. Estes registos ficaram guardados, mas parecem estranhos. Confirma ou corrige em Movimentos.</p>
      {snap.conflicts.length === 0 && rejected.length === 0 ? <Empty title="Está tudo certo" icon="check" /> : null}
      <div className="m-list">
        {snap.conflicts.map((conflict) => (
          <Row
            key={conflict.id}
            icon="flag"
            tone="warn"
            title={CONFLICT_LABELS[conflict.kind] ?? conflict.kind}
            detail={conflict.message}
            value={<button className="btn btn-ghost btn-s" type="button" disabled={busy} onClick={() => run(async () => { await call("conflict.resolve", { conflictId: conflict.id }); await refresh(); }, "Confirmado.")}>Está certo</button>}
          />
        ))}
        {rejected.map((result) => (
          <Row key={result.opId} icon="x" tone="warn" title="Não foi registado" detail={result.message} />
        ))}
      </div>
    </Screen>
  );
}

export function ProfileScreen() {
  const { snap, call, refresh } = useStore();
  const [pins, setPins] = useState({ current: "", next: "" });
  const [support, setSupport] = useState("");
  const { busy, run } = useBusy();
  if (!snap?.owner) return null;
  return (
    <Screen title="Perfil">
      <Card>
        <strong className="m-big">{snap.owner.displayName}</strong>
        <span className="small muted">
          {snap.owner.businessName} · {snap.owner.marketName}
          {snap.owner.stall ? ` · ${snap.owner.stall}` : ""}
        </span>
        <span className="small">{formatPhone(snap.owner.phone)}</span>
      </Card>
      {snap.agent ? (
        <Card tone="soft">
          <span className="small muted">O teu agente</span>
          <strong>{snap.agent.name}</strong>
          <span className="small">
            {snap.agent.kiosk}
            {snap.agent.hours ? ` · ${snap.agent.hours}` : ""}
          </span>
          {snap.agent.phone ? (
            <a className="btn btn-primary btn-s" href={`tel:${snap.agent.phone}`} style={{ alignSelf: "flex-start" }}>
              Ligar {formatPhone(snap.agent.phone)}
            </a>
          ) : null}
        </Card>
      ) : null}
      {snap.lease ? (
        <Card>
          <strong>O teu telefone</strong>
          <span className="small">
            {snap.lease.paid} de {snap.lease.instalments} prestações pagas
            {snap.lease.next ? ` · próxima ${formatMT(snap.lease.next.amountCents)} em ${formatShortDay(snap.lease.next.dueDate)}` : ""}
          </span>
        </Card>
      ) : null}
      <Card>
        <strong>{snap.owner.hasPin ? "Mudar o PIN" : "Criar PIN"}</strong>
        {snap.owner.hasPin ? (
          <label className="field">
            <span className="label">PIN actual</span>
            <input className="input num" type="password" inputMode="numeric" maxLength={6} value={pins.current} onChange={(event) => setPins({ ...pins, current: event.target.value })} />
          </label>
        ) : null}
        <label className="field">
          <span className="label">Novo PIN</span>
          <input className="input num" type="password" inputMode="numeric" maxLength={6} value={pins.next} onChange={(event) => setPins({ ...pins, next: event.target.value })} />
        </label>
        <button className="btn btn-primary" type="button" disabled={busy || pins.next.length < 4} onClick={() => run(async () => { await call("pin.set", { pin: pins.next, currentPin: pins.current || undefined }); setPins({ current: "", next: "" }); await refresh(); }, "PIN guardado.")}>
          Guardar PIN
        </button>
      </Card>
      <Card>
        <strong>Pedir ajuda</strong>
        <textarea className="textarea" value={support} onChange={(event) => setSupport(event.target.value)} placeholder="Conta o que se passa" />
        <button className="btn btn-ghost" type="button" disabled={busy || support.trim().length < 3} onClick={() => run(async () => { const result = await call<{ code: string }>("support.open", { title: support.trim().slice(0, 80), description: support.trim() }); setSupport(""); return result; }, "Pedido enviado ao teu agente.")}>
          Enviar ao agente
        </button>
      </Card>
      <form action="/api/app/signout" method="post">
        <button className="btn btn-ghost btn-full" type="submit">
          Sair desta conta
        </button>
      </form>
      <p className="m-note">Ao sair, os dados guardados neste telefone são apagados.</p>
    </Screen>
  );
}
