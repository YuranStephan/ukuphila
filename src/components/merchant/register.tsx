"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { interpret, parseWalletSms, type Interpretation } from "@/lib/interpret";
import { EXPENSE_CATEGORIES } from "@/lib/labels";
import { formatMT } from "@/lib/money";
import { AmountPad, Chips, Sheet, useBusy } from "./kit";
import { useStore } from "./store";

export type RecordKind = "venda" | "despesa" | "compra" | "casa" | "fiado_recebido" | "poupanca";

const KINDS: { value: RecordKind; label: string }[] = [
  { value: "venda", label: "Vendi" },
  { value: "despesa", label: "Gastei" },
  { value: "compra", label: "Comprei stock" },
  { value: "casa", label: "Para casa" },
  { value: "fiado_recebido", label: "Pagaram-me fiado" },
  { value: "poupanca", label: "Guardei" },
];

type Draft = { kind: RecordKind; cents: number; productId: string; quantity: number; customerId: string; onCredit: boolean; category: string; pocket: "negocio" | "casa"; goalId: string; memo: string };

const blank = (kind: RecordKind): Draft => ({ kind, cents: 0, productId: "", quantity: 1, customerId: "", onCredit: false, category: "transporte", pocket: "negocio", goalId: "", memo: "" });

function fromInterpretation(result: Interpretation, products: { id: string; name: string }[], customers: { id: string; name: string }[]): Partial<Draft> | null {
  const find = <T extends { name: string }>(list: T[], name?: string) => (name ? list.find((row) => row.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(row.name.toLowerCase())) : undefined);
  const product = find(products, result.item);
  const customer = find(customers, result.person);
  const base = { cents: result.amountCents ?? 0, memo: result.item ?? "" };
  switch (result.intent) {
    case "RECORD_SALE":
      return { ...base, kind: "venda", productId: product?.id ?? "", quantity: result.quantity ?? 1 };
    case "RECORD_FIADO_SALE":
      return { ...base, kind: "venda", onCredit: true, customerId: customer?.id ?? "" };
    case "RECORD_EXPENSE":
      return { ...base, kind: "despesa", category: result.category ?? "outro" };
    case "RECORD_PURCHASE":
      return { ...base, kind: "compra", productId: product?.id ?? "", quantity: result.quantity ?? 1 };
    case "TRANSFER_HOME":
      return { ...base, kind: "casa" };
    case "RECORD_SAVING":
      return { ...base, kind: "poupanca" };
    case "FIADO_REPAID":
      return { ...base, kind: "fiado_recebido", customerId: customer?.id ?? "" };
    default:
      return null;
  }
}

type Recognition = { lang: string; interimResults: boolean; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: () => void; onend: () => void; start: () => void; stop: () => void };

function getRecognition(): Recognition | null {
  const Constructor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
  return Constructor ? new Constructor() : null;
}

/**
 * One sheet for every record. Voice and typed phrases go through the same local interpreter, fill the form, and stop:
 * the person always sees the record and confirms it. Nothing is ever recorded from speech alone.
 */
export function RecordSheet({ open, onClose, initialKind = "venda", initialText }: { open: boolean; onClose: () => void; initialKind?: RecordKind; initialText?: string }) {
  const { snap, record } = useStore();
  const [draft, setDraft] = useState<Draft>(blank(initialKind));
  const [phrase, setPhrase] = useState("");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [channel, setChannel] = useState<"app" | "voz">("app");
  const recognition = useRef<Recognition | null>(null);
  const { busy, run } = useBusy();

  const products = snap?.products ?? [];
  const customers = snap?.customers ?? [];
  const goals = (snap?.goals ?? []).filter((goal) => goal.status === "activa");

  const understand = (text: string, via: "app" | "voz") => {
    const result = parseWalletSms(text) ?? interpret(text);
    const patch = fromInterpretation(result, products, customers);
    setHeard(text);
    if (patch) {
      setDraft((current) => ({ ...blank(patch.kind ?? current.kind), ...patch }) as Draft);
      setChannel(via);
    }
    return Boolean(patch);
  };

  useEffect(() => {
    if (!open) return;
    setDraft(blank(initialKind));
    setHeard(null);
    setChannel("app");
    setPhrase("");
    if (initialText) understand(initialText, "app");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKind, initialText]);

  const listen = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const engine = getRecognition();
    if (!engine) {
      setHeard("Este telefone não tem reconhecimento de voz. Escreve a frase em baixo.");
      return;
    }
    engine.lang = "pt-PT";
    engine.interimResults = false;
    engine.onresult = (event) => understand(event.results[0][0].transcript, "voz");
    engine.onerror = () => setHeard("Não ouvi bem. Tenta outra vez ou escreve.");
    engine.onend = () => setListening(false);
    recognition.current = engine;
    setListening(true);
    engine.start();
  };

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const product = products.find((row) => row.id === draft.productId);

  const save = () =>
    run(async () => {
      if (draft.cents <= 0) throw new Error("Escreve o valor.");
      const memo = draft.memo.trim() || null;
      switch (draft.kind) {
        case "venda":
          if (draft.onCredit && !draft.customerId) throw new Error("Escolhe quem ficou a dever.");
          await record("sale.record", { amountCents: draft.cents, productId: draft.productId || null, quantity: draft.productId ? draft.quantity : null, customerId: draft.onCredit ? draft.customerId : null, memo }, channel);
          break;
        case "despesa":
          await record("expense.record", { amountCents: draft.cents, category: draft.category, pocket: draft.pocket, memo }, channel);
          break;
        case "compra":
          if (!draft.productId) throw new Error("Escolhe o produto. Se for novo, cria-o em Negócio.");
          await record("stock.purchase", { amountCents: draft.cents, productId: draft.productId, quantity: draft.quantity, pocket: "negocio", memo }, channel);
          break;
        case "casa":
          await record("pocket.transfer", { from: "negocio", to: "casa", amountCents: draft.cents, memo }, channel);
          break;
        case "fiado_recebido":
          if (!draft.customerId) throw new Error("Escolhe quem pagou.");
          await record("fiado.repay", { customerId: draft.customerId, amountCents: draft.cents, memo }, channel);
          break;
        case "poupanca":
          await record("savings.deposit", { amountCents: draft.cents, goalId: draft.goalId || null, pocket: "negocio", memo }, channel);
          break;
      }
      onClose();
    }, navigator.onLine ? "Registado." : "Guardado no telefone. Sincroniza quando houver rede.");

  return (
    <Sheet open={open} onClose={onClose} title="Registar">
      <div className="m-voice">
        <button type="button" className="m-mic" data-on={listening} onClick={listen} aria-label={listening ? "Parar de ouvir" : "Falar"}>
          <Icon name="mic" size={26} />
        </button>
        <form
          className="m-phrase"
          onSubmit={(event) => {
            event.preventDefault();
            if (phrase.trim()) understand(phrase, "app");
          }}
        >
          <input className="input" value={phrase} onChange={(event) => setPhrase(event.target.value)} placeholder="Ou escreve: vendi 3 sacos por 3600" aria-label="Frase" />
        </form>
      </div>
      {heard ? <p className="m-heard">“{heard}”</p> : null}

      <Chips value={draft.kind} options={KINDS} onChange={(kind) => setDraft({ ...blank(kind), cents: draft.cents })} />

      <AmountPad cents={draft.cents} onChange={(cents) => set({ cents })} />

      <div className="m-fields">
        {draft.kind === "venda" || draft.kind === "compra" ? (
          <div className="row">
            <label className="field grow">
              <span className="label">Produto</span>
              <select className="select" value={draft.productId} onChange={(event) => set({ productId: event.target.value })}>
                <option value="">{draft.kind === "venda" ? "Sem produto" : "Escolhe"}</option>
                {products.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} ({row.quantity} {row.unit})
                  </option>
                ))}
              </select>
            </label>
            {draft.productId ? (
              <label className="field" style={{ width: 96 }}>
                <span className="label">Quantidade</span>
                <input className="input num" type="number" min={1} value={draft.quantity} onChange={(event) => set({ quantity: Math.max(1, Number(event.target.value) || 1) })} />
              </label>
            ) : null}
          </div>
        ) : null}
        {draft.kind === "venda" && product?.salePriceCents && draft.cents === 0 ? (
          <button type="button" className="btn btn-ghost btn-s" onClick={() => set({ cents: (product.salePriceCents ?? 0) * draft.quantity })}>
            Usar preço habitual: {formatMT((product.salePriceCents ?? 0) * draft.quantity)}
          </button>
        ) : null}
        {draft.kind === "venda" ? (
          <label className="check">
            <input type="checkbox" checked={draft.onCredit} onChange={(event) => set({ onCredit: event.target.checked })} />
            <span>Ficou a dever (fiado)</span>
          </label>
        ) : null}
        {(draft.kind === "venda" && draft.onCredit) || draft.kind === "fiado_recebido" ? (
          <label className="field">
            <span className="label">Cliente</span>
            <select className="select" value={draft.customerId} onChange={(event) => set({ customerId: event.target.value })}>
              <option value="">Escolhe</option>
              {customers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                  {row.owedCents > 0 ? ` · deve ${formatMT(row.owedCents)}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {draft.kind === "despesa" ? (
          <>
            <Chips value={draft.category} options={EXPENSE_CATEGORIES.map((row) => ({ value: row.key, label: row.label }))} onChange={(category) => set({ category })} />
            <Chips value={draft.pocket} options={[{ value: "negocio", label: "Do negócio" }, { value: "casa", label: "De casa" }]} onChange={(pocket) => set({ pocket })} />
          </>
        ) : null}
        {draft.kind === "poupanca" && goals.length ? (
          <label className="field">
            <span className="label">Meta</span>
            <select className="select" value={draft.goalId} onChange={(event) => set({ goalId: event.target.value })}>
              <option value="">Sem meta</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="field">
          <span className="label">Nota (opcional)</span>
          <input className="input" value={draft.memo} onChange={(event) => set({ memo: event.target.value })} maxLength={120} />
        </label>
      </div>
      <button className="btn btn-sun btn-full m-save" type="button" disabled={busy || draft.cents <= 0} onClick={save}>
        {draft.cents > 0 ? `Confirmar ${formatMT(draft.cents)}` : "Escreve o valor"}
      </button>
    </Sheet>
  );
}
