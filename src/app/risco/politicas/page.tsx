import type { Metadata } from "next";
import { approvePolicyAction, proposePolicyAction } from "@/actions/credit";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, DataNote, EmptyState, PageHead, SectionTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { formatMT, formatPct } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";
import { activePolicy } from "@/server/credit/service";
import { getDb } from "@/server/db/client";
import { creditPolicyHistory } from "@/server/risk/queries";

export const metadata: Metadata = { title: "Políticas de crédito" };

export default async function PoliciesPage() {
  const user = await requirePage("risk.read", "/risco/politicas");
  const db = await getDb();
  const [active, policies] = await Promise.all([activePolicy(db), creditPolicyHistory(db)]);
  return <>
    <PageHead eyebrow="Condições definidas pela gestão" title="Políticas de crédito" lead="Cada proposta exige aprovação de outra pessoa. A política aprovada aplica-se a novos pedidos. Cada contrato mantém o registo das condições aceites." />
    <DataNote>Confirma limites, prazos e custos antes de propor uma política. Só uma política pode estar em vigor.</DataNote>
    {[{ status: "aprovada", title: "Em vigor", rows: active ? [active] : [] }, { status: "rascunho", title: "Rascunhos por aprovar", rows: policies.filter((row) => row.status === "rascunho") }, { status: "arquivada", title: "Arquivadas", rows: policies.filter((row) => row.status === "arquivada") }].map((group) => <section className="block" key={group.status}><SectionTitle title={group.title} />
      {!group.rows.length ? <div className="card"><EmptyState icon="document" title={group.status === "aprovada" ? "Sem política em vigor" : "Sem políticas nesta lista"}>{group.status === "aprovada" ? "O crédito precisa de uma política aprovada por outra pessoa antes de receber pedidos." : null}</EmptyState></div> : <div className="stack">{group.rows.map((policy) => <article className="card" key={policy.id}>
        <div className="row-between wrap"><h3 className="card-title" style={{ overflowWrap: "anywhere" }}>Versão {policy.version}</h3><Badge tone={policy.status === "aprovada" ? "good" : policy.status === "rascunho" ? "warn" : "neutral"}>{group.title}</Badge></div>
        <p className="small muted block">Proposta em {formatDateTime(policy.createdAt)}{policy.approvedAt ? ` · Aprovada em ${formatDateTime(policy.approvedAt)}` : ""}</p>
        <div className="table-wrap block"><table className="table"><caption className="sr-only">Condições da política {policy.version}</caption><thead><tr><th scope="col">Parâmetro</th><th scope="col">Valor</th></tr></thead><tbody>
          <tr><td>Limite do primeiro contrato</td><td className="num">{formatMT(policy.params.maxAmountByRing.base)}</td></tr>
          <tr><td>Limite após uma liquidação</td><td className="num">{formatMT(policy.params.maxAmountByRing.second)}</td></tr>
          <tr><td>Limite após duas ou mais liquidações</td><td className="num">{formatMT(policy.params.maxAmountByRing.third)}</td></tr>
          <tr><td>Prazos admitidos</td><td>{policy.params.termOptionsDays.join(", ")} dias</td></tr>
          <tr><td>Custo sobre o capital</td><td className="num">{formatPct(policy.params.feePercentBasisPoints / 10_000, 2)}</td></tr>
          <tr><td>Dias de tolerância</td><td className="num">{policy.params.graceDays}</td></tr>
          <tr><td>Incumprimento após atraso de</td><td className="num">{policy.params.defaultAfterDays} dias</td></tr>
          <tr><td>Limite de concentração</td><td className="num">{formatPct(policy.params.concentrationLimitPct / 100, 1)}</td></tr>
        </tbody></table></div>
        {policy.note ? <p className="callout block" style={{ whiteSpace: "pre-wrap" }}>{policy.note}</p> : null}
        {policy.status === "rascunho" && can(user.role, "credit.policy.approve") && policy.createdBy !== user.id ? <ActionForm className="stack block" action={approvePolicyAction.bind(null, policy.id)}><p className="hint">Ao aprovar, esta versão substitui a política em vigor para novos pedidos.</p><SubmitButton>Aprovar esta política</SubmitButton></ActionForm> : null}
        {policy.status === "rascunho" && policy.createdBy === user.id ? <p className="hint block">A tua proposta precisa de aprovação de outra pessoa.</p> : null}
      </article>)}</div>}
    </section>)}
    {can(user.role, "credit.policy.propose") ? <section className="card block"><SectionTitle title="Propor uma política" /><ActionForm action={proposePolicyAction}>
      <label className="field" htmlFor="policy-version"><span>Versão</span><input className="input" id="policy-version" name="version" required maxLength={80} /></label>
      <div className="grid-even">{[{ name: "base", label: "Limite do primeiro contrato (MT)" }, { name: "second", label: "Limite após uma liquidação (MT)" }, { name: "third", label: "Limite após duas liquidações (MT)" }].map((field) => <label className="field" htmlFor={`policy-${field.name}`} key={field.name}><span>{field.label}</span><input className="input num" id={`policy-${field.name}`} name={field.name} type="number" inputMode="decimal" min="0.01" step="0.01" required /></label>)}</div>
      <label className="field" htmlFor="policy-terms"><span>Prazos em dias, separados por vírgulas</span><input className="input" id="policy-terms" name="terms" required pattern="[1-9][0-9]*(,[ ]*[1-9][0-9]*)*" aria-describedby="policy-terms-help" /><span className="hint" id="policy-terms-help">Indica apenas prazos inteiros e positivos aprovados para a proposta.</span></label>
      <div className="grid-even">
        <label className="field" htmlFor="policy-fee"><span>Custo sobre o capital (%)</span><input className="input num" id="policy-fee" name="fee" type="number" min="0" step="0.01" required /></label>
        <label className="field" htmlFor="policy-grace"><span>Dias de tolerância</span><input className="input num" id="policy-grace" name="grace" type="number" min="0" step="1" required /></label>
        <label className="field" htmlFor="policy-default"><span>Dias de atraso até incumprimento</span><input className="input num" id="policy-default" name="defaultAfter" type="number" min="1" step="1" required /></label>
        <label className="field" htmlFor="policy-concentration"><span>Limite de concentração (%)</span><input className="input num" id="policy-concentration" name="concentration" type="number" min="0" max="100" step="0.01" required /></label>
      </div>
      <label className="field" htmlFor="policy-note"><span>Fundamentação da proposta</span><textarea className="textarea" id="policy-note" name="note" required minLength={10} maxLength={4000} /></label>
      <p className="hint">A proposta fica em rascunho. Só entra em vigor depois da aprovação de outra pessoa.</p>
      <SubmitButton>Submeter para aprovação</SubmitButton>
    </ActionForm></section> : null}
  </>;
}
