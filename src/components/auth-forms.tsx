"use client";

import { useActionState, useState } from "react";
import { requestCodeAction, signupAction, staffLoginAction, verifyCodeAction, type OtpState } from "@/actions/auth";
import { SubmitButton } from "./forms";

function CodeStep({ phone, demoCode, next }: { phone: string; demoCode?: string; next?: string }) {
  const [state, action] = useActionState(verifyCodeAction, { phone } as OtpState);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="phone" value={phone} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="field">
        <label htmlFor="code">Código de 6 números</label>
        <input id="code" className="input num" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus defaultValue={demoCode} />
        {demoCode ? <span className="hint">Modo de demonstração: numa operação real, o código chega por WhatsApp ou SMS.</span> : null}
      </div>
      {state.error ? (
        <p className="form-message" data-kind="error" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton className="btn btn-primary btn-full">Entrar</SubmitButton>
    </form>
  );
}

export function PhoneLogin({ next }: { next?: string }) {
  const [state, action] = useActionState(requestCodeAction, {} as OtpState);
  if (state.ok && state.phone) return <CodeStep phone={state.phone} demoCode={state.demoCode} next={next} />;
  return (
    <form action={action} className="stack">
      <div className="field">
        <label htmlFor="phone">Número de telemóvel</label>
        <input id="phone" className="input num" name="phone" inputMode="tel" autoComplete="tel" placeholder="84 123 4567" required />
      </div>
      {state.error ? (
        <p className="form-message" data-kind="error" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton className="btn btn-primary btn-full">Receber código</SubmitButton>
    </form>
  );
}

export function StaffLogin({ next }: { next?: string }) {
  const [state, action] = useActionState(staffLoginAction, {});
  return (
    <form action={action} className="stack">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="field">
        <label htmlFor="email">Email de trabalho</label>
        <input id="email" className="input" type="email" name="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Palavra-passe</label>
        <input id="password" className="input" type="password" name="password" autoComplete="current-password" required />
      </div>
      {state.needsTotp ? (
        <div className="field">
          <label htmlFor="totp">Código da aplicação de autenticação</label>
          <input id="totp" className="input num" name="totp" inputMode="numeric" maxLength={6} autoFocus />
        </div>
      ) : null}
      {state.error ? (
        <p className="form-message" data-kind="error" role="alert">
          {state.error}
        </p>
      ) : null}
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
  if (state.ok && state.phone) return <CodeStep phone={state.phone} demoCode={state.demoCode} />;
  return (
    <form action={action} className="stack">
      <div className="field">
        <label htmlFor="phone">Número de telemóvel</label>
        <input id="phone" className="input num" name="phone" inputMode="tel" placeholder="84 123 4567" required />
      </div>
      <div className="field">
        <label htmlFor="displayName">Como te chamam?</label>
        <input id="displayName" className="input" name="displayName" placeholder="Dona Celeste" required />
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
      {state.error ? (
        <p className="form-message" data-kind="error" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton className="btn btn-primary btn-full">Criar conta</SubmitButton>
    </form>
  );
}
