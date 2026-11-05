"use client";

import { useActionState } from "react";
import { issueActivationCodeAction, type ActivationState } from "@/actions/activation";

/** One-time entry code for someone who signs in with their phone. Shown once; a new code cancels the previous one. */
export function ActivationCode({ userId, label = "Gerar código de entrada" }: { userId: string; label?: string }) {
  const [state, action, pending] = useActionState(issueActivationCodeAction.bind(null, userId), {} as ActivationState);
  if (state.code) {
    return (
      <div className="stack" style={{ ["--gap" as string]: "4px" }}>
        <strong className="mono num" style={{ fontSize: "1.5rem", letterSpacing: "0.12em" }}>
          {state.code.replace(/(\d{4})(\d{4})/, "$1 $2")}
        </strong>
        <span className="tiny muted">Válido 24 horas. A pessoa entra com o telefone e este código, e cria o seu PIN.</span>
      </div>
    );
  }
  return (
    <form action={action} className="stack" style={{ ["--gap" as string]: "4px" }}>
      <button className="btn btn-ghost btn-s" type="submit" disabled={pending}>
        {pending ? "A gerar…" : label}
      </button>
      {state.error ? <span className="tiny" style={{ color: "var(--caju-escuro)" }}>{state.error}</span> : null}
    </form>
  );
}
