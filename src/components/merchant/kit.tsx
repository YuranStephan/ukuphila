"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icon";
import { formatMT } from "@/lib/money";
import { useStore } from "./store";

export function Money({ cents, sign, className }: { cents: number; sign?: boolean; className?: string }) {
  return <span className={`num ${className ?? ""}`}>{formatMT(cents, { sign })}</span>;
}

export function Screen({ title, back, action, children }: { title: string; back?: string; action?: ReactNode; children: ReactNode }) {
  const { navigate } = useStore();
  return (
    <section className="m-screen">
      <header className="m-screen-head">
        {back ? (
          <button className="m-icon-btn" type="button" aria-label="Voltar" onClick={() => navigate(back)}>
            <Icon name="arrowLeft" size={20} />
          </button>
        ) : null}
        <h1>{title}</h1>
        {action ? <div className="m-head-action">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function Card({ children, tone, className }: { children: ReactNode; tone?: "night" | "sun" | "soft"; className?: string }) {
  return (
    <div className={`m-card ${className ?? ""}`} data-tone={tone}>
      {children}
    </div>
  );
}

export function Row({ icon, title, detail, value, onClick, tone }: { icon?: IconName; title: ReactNode; detail?: ReactNode; value?: ReactNode; onClick?: () => void; tone?: "in" | "out" | "warn" }) {
  const body = (
    <>
      {icon ? (
        <span className="m-row-icon" data-tone={tone}>
          <Icon name={icon} size={19} />
        </span>
      ) : null}
      <span className="m-row-text">
        <span className="m-row-title">{title}</span>
        {detail ? <span className="m-row-detail">{detail}</span> : null}
      </span>
      {value ? <span className="m-row-value">{value}</span> : null}
    </>
  );
  return onClick ? (
    <button type="button" className="m-row" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="m-row">{body}</div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="m-sheet" onClose={onClose} onCancel={onClose}>
      <div className="m-sheet-head">
        <h2>{title}</h2>
        <button className="m-icon-btn" type="button" aria-label="Fechar" onClick={onClose}>
          <Icon name="x" size={20} />
        </button>
      </div>
      {open ? children : null}
    </dialog>
  );
}

/** Big keys for thumbs in the sun. Values are typed in meticais; the parent stores centavos. */
export function AmountPad({ cents, onChange }: { cents: number; onChange: (cents: number) => void }) {
  const meticais = Math.floor(cents / 100);
  const press = (key: string) => {
    if (key === "del") return onChange(Math.floor(meticais / 10) * 100);
    if (key === "000") return onChange(Math.min(meticais * 1000, 99_999_999) * 100);
    return onChange(Math.min(meticais * 10 + Number(key), 99_999_999) * 100);
  };
  return (
    <div className="m-pad">
      <output className="m-pad-value num" aria-live="polite">
        {formatMT(cents)}
      </output>
      <div className="m-pad-keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "del"].map((key) => (
          <button key={key} type="button" onClick={() => press(key)} aria-label={key === "del" ? "Apagar" : key}>
            {key === "del" ? <Icon name="arrowLeft" size={22} /> : key}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="m-chips" role="radiogroup">
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon = "box", title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="m-empty">
      <Icon name={icon} size={26} />
      <strong>{title}</strong>
      {children ? <span>{children}</span> : null}
    </div>
  );
}

/** Reads a line aloud when the phone can, for people who prefer listening to reading. */
export function Speak({ text }: { text: string }) {
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(typeof window !== "undefined" && "speechSynthesis" in window), []);
  if (!supported) return null;
  return (
    <button
      type="button"
      className="m-icon-btn"
      aria-label="Ouvir"
      onClick={() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-PT";
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }}
    >
      <Icon name="volume" size={18} />
    </button>
  );
}

export function useBusy() {
  const [busy, setBusy] = useState(false);
  const { toast } = useStore();
  const run = async (work: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await work();
      if (success) toast(success);
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível concluir.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}
