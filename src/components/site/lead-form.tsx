import { submitLeadAction } from "@/actions/site";
import { ActionForm, SubmitButton } from "@/components/forms";

export function LeadForm({ kind, fields = [], cta = "Enviar" }: { kind: "comerciante" | "agente" | "fornecedor" | "parceiro" | "investidor"; fields?: ("organisation" | "market" | "email")[]; cta?: string }) {
  return (
    <ActionForm action={submitLeadAction}>
      <input type="hidden" name="kind" value={kind} />
      <div className="field">
        <label htmlFor={`${kind}-name`}>Nome</label>
        <input id={`${kind}-name`} className="input" name="name" required />
      </div>
      <div className="field">
        <label htmlFor={`${kind}-phone`}>Telefone</label>
        <input id={`${kind}-phone`} className="input" name="phone" inputMode="tel" />
      </div>
      {fields.includes("email") ? (
        <div className="field">
          <label htmlFor={`${kind}-email`}>Email</label>
          <input id={`${kind}-email`} className="input" type="email" name="email" />
        </div>
      ) : null}
      {fields.includes("organisation") ? (
        <div className="field">
          <label htmlFor={`${kind}-org`}>Organização</label>
          <input id={`${kind}-org`} className="input" name="organisation" />
        </div>
      ) : null}
      {fields.includes("market") ? (
        <div className="field">
          <label htmlFor={`${kind}-market`}>Mercado</label>
          <input id={`${kind}-market`} className="input" name="market" />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor={`${kind}-message`}>Mensagem (opcional)</label>
        <textarea id={`${kind}-message`} className="textarea" name="message" />
      </div>
      <SubmitButton>{cta}</SubmitButton>
    </ActionForm>
  );
}
