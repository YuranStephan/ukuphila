"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { interpret, parseWalletSms, type Interpretation } from "@/lib/interpret";
import { EXPENSE_CATEGORIES } from "@/lib/labels";
import { formatMT } from "@/lib/money";

const EXAMPLES = ["Vendi duas caixas de tomate por dois mil", "Gastei 150 de transporte", "Tirei mil e quinhentos para casa", "A Rita pagou 300 do fiado", "Quanto tenho?"];

const TITLES: Record<string, string> = {
  RECORD_SALE: "Venda",
  RECORD_FIADO_SALE: "Venda a fiado",
  RECORD_EXPENSE: "Despesa",
  RECORD_PURCHASE: "Compra de stock",
  TRANSFER_HOME: "Do Negócio para a Casa",
  RECORD_SAVING: "Poupança",
  FIADO_REPAID: "Fiado recebido",
};

const ANSWERS: Record<string, string> = {
  CHECK_BALANCE: "Consulta o saldo no registo. A IA nunca inventa um número.",
  DAILY_SUMMARY: "Mostra o resumo do dia a partir dos movimentos.",
  XITIQUE_STATUS: "Consulta o estado real do grupo.",
  SAVINGS_STATUS: "Consulta a poupança registada.",
  CREDIT_INFO: "Explica como funciona, sem prometer aprovação.",
  HUMAN_SUPPORT: "Chama o teu agente.",
  KYC_HELP: "Explica o que falta, a partir do teu estado real.",
  DOCUMENT_STATUS: "Consulta o estado do documento.",
};

function describe(result: Interpretation) {
  const title = TITLES[result.intent];
  if (!title) return null;
  const parts = [
    result.quantity ? `${result.quantity}${result.item ? ` ${result.item}` : ""}` : result.item,
    result.person,
    result.category ? EXPENSE_CATEGORIES.find((row) => row.key === result.category)?.label : undefined,
  ].filter(Boolean);
  return { title, detail: parts.join(" · ") };
}

/** Runs the same interpreter the product uses, here in the visitor's browser, with no network and no account. */
export function VoiceDemo() {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const text = typed ?? EXAMPLES[index];
  const result = useMemo(() => parseWalletSms(text) ?? interpret(text), [text]);
  const record = describe(result);

  useEffect(() => {
    if (typed !== null) return;
    const timer = setInterval(() => {
      setConfirmed(false);
      setIndex((value) => (value + 1) % EXAMPLES.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [typed]);

  return (
    <div className="voice-demo">
      <label className="voice-input">
        <span className="voice-mic">
          <Icon name="mic" size={18} />
        </span>
        <input
          aria-label="Escreve uma frase como dirias ao telefone"
          value={text}
          onChange={(event) => {
            setTyped(event.target.value);
            setConfirmed(false);
          }}
          onFocus={() => setTyped(text)}
        />
      </label>
      <div className="voice-result" key={text}>
        {record ? (
          <>
            <span className="voice-kind">{record.title}</span>
            <strong className="num voice-amount">{result.amountCents ? formatMT(result.amountCents) : "Quanto foi?"}</strong>
            {record.detail ? <span className="voice-detail">{record.detail}</span> : null}
            <div className="voice-actions">
              {confirmed ? (
                <span className="voice-done">
                  <Icon name="check" size={16} /> Registado depois de tu confirmares
                </span>
              ) : (
                <>
                  <button className="btn btn-sun btn-s" type="button" disabled={!result.amountCents} onClick={() => setConfirmed(true)}>
                    Confirmar
                  </button>
                  <span className="voice-note">Nada é registado sem confirmação</span>
                </>
              )}
            </div>
          </>
        ) : ANSWERS[result.intent] ? (
          <span className="voice-answer">{ANSWERS[result.intent]}</span>
        ) : (
          <span className="voice-answer">Não percebi bem. Experimenta “Vendi 500”.</span>
        )}
      </div>
    </div>
  );
}
