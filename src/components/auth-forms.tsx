"use client";

import { useActionState, useState } from "react";
import { activationLoginAction, phoneStepAction, pinLoginAction, type PhoneLoginState } from "@/actions/activation";
import { signupAction, staffLoginAction, type OtpState, type StaffLoginState } from "@/actions/auth";
import { SubmitButton } from "./forms";

function ErrorLine({ message }: { message?: string }) {
  return message ? (
    <p className="form-message" data-kind="error" role="alert">
      {message}
    </p>
  ) : null;
}

function PinStep({ state, next, onCode }: { state: PhoneLoginState; next?: string; onCode: () => void }) {
  const [current, action] = useActionState(pinLoginAction, state);
  return (
    <form action={action} className="stack">
      <p className="muted">Olá, {state.step?.name}. Escreve o teu PIN.</p>
      <input type="hidden" name="phone" value={state.step?.phone} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="field">
        <label htmlFor="pin">PIN</label>
        <input id="pin" className="input num pin-input" name="pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} required autoFocus />
      </div>
      <ErrorLine message={current.error} />
      <SubmitButton className="btn btn-primary btn-full">Entrar</SubmitButton>
      <button type="button" className="link small" onClick={onCode} style={{ alignSelf: "flex-start" }}>
        Esqueci o PIN ou tenho um código do agente
      </button>
    </form>
  );
}

function CodeStep({ state, next }: { state: PhoneLoginState; next?: string }) {
  const [current, action] = useActionState(activationLoginAction, state);
  return (
    <form action={action} className="stack">
      <p className="muted">Escreve o código de 8 números que o teu agente te deu e escolhe um PIN só teu.</p>
      <input type="hidden" name="phone" value={state.step?.phone} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="field">
        <label htmlFor="code">Código do agente</label>
        <input id="code" className="input num" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={9} required autoFocus />
      </div>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="field grow">
          <label htmlFor="pin">Novo PIN</label>
          <input id="pin" className="input num" name="pin" type="password" inputMode="numeric" autoComplete="new-password" minLength={4} maxLength={6} required />
        </div>
        <div className="field grow">
          <label htmlFor="pinConfirm">Repete o PIN</label>
          <input id="pinConfirm" className="input num" name="pinConfirm" type="password" inputMode="numeric" autoComplete="new-password" minLength={4} maxLength={6} required />
        </div>
      </div>
      <p className="hint">4 a 6 números. Não uses 1234 nem o mesmo número repetido.</p>
      <ErrorLine message={current.error} />
      <SubmitButton className="btn btn-primary btn-full">Activar e entrar</SubmitButton>
    </form>
  );
}

export function PhoneLogin({ next }: { next?: string }) {
  const [state, action] = useActionState(phoneStepAction, {} as PhoneLoginState);
  const [forceCode, setForceCode] = useState(false);
  if (state.ok && state.step) {
    return state.step.method === "pin" && !forceCode ? <PinStep state={state} next={next} onCode={() => setForceCode(true)} /> : <CodeStep state={state} next={next} />;
  }
  return (
    <form action={action} className="stack">
      <div className="field">
        <label htmlFor="phone">Número de telemóvel</label>
        <input id="phone" className="input num" name="phone" inputMode="tel" autoComplete="tel" placeholder="84 123 4567" required />
      </div>
      <ErrorLine message={state.error} />
      <SubmitButton className="btn btn-primary btn-full">Continuar</SubmitButton>
    </form>
  );
}

export function StaffLogin({ next }: { next?: string }) {
  const [state, action] = useActionState(staffLoginAction, {} as StaffLoginState);
  return (
    <form action={action} className="stack">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="field">
        <label htmlFor="email">Email ou utilizador</label>
        <input id="email" className="input" type="text" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </div>
      <div className="field">
        <label htmlFor="password">Palavra-passe</label>
        <input id="password" className="input" type="password" name="password" autoComplete="current-password" required />
      </div>
      {state.enrolment ? <div className="callout stack"><strong>Configura a autenticação da tua conta</strong><p className="small">Acrescenta uma conta Ukuphila na tua aplicação de autenticação com esta chave. Depois escreve o código de 6 números para confirmar.</p><code className="mono" style={{ overflowWrap: "anywhere" }}>{state.enrolment.secret}</code></div> : null}
      {state.needsTotp ? (
        <div className="field">
          <label htmlFor="totp">Código da aplicação de autenticação</label>
          <input id="totp" className="input num" name="totp" inputMode="numeric" maxLength={6} autoFocus />
        </div>
      ) : null}
      <ErrorLine message={state.error} />
      <SubmitButton className="btn btn-primary btn-full">Entrar</SubmitButton>
    </form>
  );
}

export function SignInSwitcher({ next }: { next?: string }) {
  const [tab, setTab] = useState<"phone" | "staff">("phone");
  return (
    <>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "phone"} onClick={() => setTab("phone")}>
          Com telefone
        </button>
        <button type="button" role="tab" aria-selected={tab === "staff"} onClick={() => setTab("staff")}>
          Equipa
        </button>
      </div>
      {tab === "phone" ? <PhoneLogin next={next} /> : <StaffLogin next={next} />}
    </>
  );
}

export function SignupForm({ markets }: { markets: { id: string; name: string }[] }) {
  const [state, action] = useActionState(signupAction, {} as OtpState);
  if (state.ok) {
    return (
      <div className="stack">
        <p className="form-message" data-kind="ok">
          Conta criada.
        </p>
        <p>{state.message}</p>
      </div>
    );
  }
  return (
    <form action={action} className="stack">
      <div className="field">
        <label htmlFor="phone">Número de telemóvel</label>
        <input id="phone" className="input num" name="phone" inputMode="tel" placeholder="84 123 4567" required />
      </div>
      <div className="field">
        <label htmlFor="displayName">Como te chamam?</label>
        <input id="displayName" className="input" name="displayName" required />
      </div>
      <div className="field">
        <label htmlFor="businessName">Nome da tua banca ou negócio</label>
        <input id="businessName" className="input" name="businessName" required />
      </div>
      <div className="field">
        <label htmlFor="marketId">Mercado</label>
        <select id="marketId" className="select" name="marketId" required defaultValue="">
          <option value="" disabled>
            Escolhe o mercado
          </option>
          {markets.map((market) => (
            <option key={market.id} value={market.id}>
              {market.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="activity">O que vendes?</label>
        <input id="activity" className="input" name="activity" placeholder="Hortícolas, peixe, capulanas…" required />
      </div>
      <label className="check">
        <input type="checkbox" name="consent" required />
        <span>Aceito que o Ukuphila guarde os meus registos para me mostrar o meu negócio.</span>
      </label>
      <ErrorLine message={state.error} />
      <SubmitButton className="btn btn-primary btn-full">Criar conta</SubmitButton>
    </form>
  );
}
