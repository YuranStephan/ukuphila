"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { simulateWhatsappAction } from "@/actions/gestao";
import { Icon } from "@/components/icon";

type Message = { me: boolean; text: string; meta?: string };

const SUGGESTIONS = ["Quanto tenho?", "Vendi 2 caixas de tomate por 2000", "sim", "Como foi hoje?", "Quanto falta para o Xitique?", "Vou ter crédito aprovado?", "Quero falar com alguém"];

/** Goes through handleInbound: the same path a real webhook message takes, only with delivery switched off. */
export function WhatsappSimulator({ people }: { people: { phone: string; name: string }[] }) {
  const [phone, setPhone] = useState(people[0]?.phone ?? "");
  const [messages, setMessages] = useState<Message[]>([{ me: false, text: "Simulador ligado ao motor real. Escreve como escreverias no WhatsApp." }]);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages]);

  const send = (value: string) => {
    const body = value.trim();
    if (!body) return;
    setMessages((list) => [...list, { me: true, text: body }]);
    setText("");
    start(async () => {
      try {
        const reply = await simulateWhatsappAction(phone, body);
        if (!reply) return;
        const meta = [reply.intent, reply.engine, ...reply.guardrails].join(" · ");
        setMessages((list) => [...list, { me: false, text: reply.text, meta }]);
      } catch {
        setMessages((list) => [...list, { me: false, text: "Não foi possível responder agora." }]);
      }
    });
  };

  return (
    <div className="stack">
      <label className="field">
        <span className="label">Falar como</span>
        <select className="select" value={phone} onChange={(event) => setPhone(event.target.value)}>
          {people.map((person) => (
            <option key={person.phone} value={person.phone}>
              {person.name}
            </option>
          ))}
        </select>
      </label>
      <div className="wa">
        <div className="wa-head">
          <Icon name="whatsapp" size={18} /> Ukuphila
        </div>
        <div className="wa-log" ref={log}>
          {messages.map((message, index) => (
            <div key={index} className="wa-msg" data-me={message.me}>
              {message.text}
              {message.meta ? <span className="wa-meta">{message.meta}</span> : null}
            </div>
          ))}
        </div>
        <form
          className="wa-input"
          onSubmit={(event) => {
            event.preventDefault();
            send(text);
          }}
        >
          <input className="input" value={text} onChange={(event) => setText(event.target.value)} placeholder="Escreve uma mensagem" aria-label="Mensagem" />
          <button className="btn btn-primary btn-s" type="submit" disabled={pending}>
            Enviar
          </button>
        </form>
      </div>
      <div className="row wrap" style={{ ["--gap" as string]: "6px" }}>
        {SUGGESTIONS.map((suggestion) => (
          <button key={suggestion} className="btn btn-ghost btn-s" type="button" onClick={() => send(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
