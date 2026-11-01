"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/actions/state";

export function SubmitButton({ children, className = "btn btn-primary", pendingLabel = "Um momento…" }: { children: ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Wraps a Server Action so every form shows its result the same way, without a page of client state. */
export function ActionForm({
  action,
  children,
  className = "stack",
  success,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  success?: string;
}) {
  const [state, formAction] = useActionState(action, {} as ActionState);
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error ? (
        <p className="form-message" data-kind="error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="form-message" data-kind="ok" role="status">
          {state.message ?? success ?? "Feito."}
        </p>
      ) : null}
    </form>
  );
}
