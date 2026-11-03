"use client";

import { useActionState } from "react";
import { startTotpAction, type TotpEnrolment } from "@/actions/gestao";

export function TotpEnrol() {
  const [state, action, pending] = useActionState(startTotpAction, {} as TotpEnrolment);
  if (state.secret) {
    return (
      <div className="stack">
        <p className="small">{state.message}</p>
        <code className="mono" style={{ wordBreak: "break-all" }}>
          {state.secret}
        </code>
        <p className="tiny muted">Mostrada uma vez. A partir de agora, o código é pedido ao entrar.</p>
      </div>
    );
  }
  return (
    <form action={action} className="stack">
      <p className="small muted">Liga uma aplicação de autenticação. Passa a ser pedido um código de 6 números ao entrar.</p>
      <button className="btn btn-primary btn-s" type="submit" disabled={pending}>
        Activar
      </button>
    </form>
  );
}
