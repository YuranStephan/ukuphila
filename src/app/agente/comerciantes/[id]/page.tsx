import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { issueActivationCodeAction } from "@/actions/activation";
import { agentDocumentAction, assistedRecordAction, attestAction, createLeaseAction, logVisitAction, onboardingStepAction, openIncidentAction, reportLostAction } from "@/actions/agent";
import { run } from "@/actions/run";
import type { ActionState } from "@/actions/state";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, EmptyState, PageHead, SectionTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPES, INCIDENT_KIND_LABELS, KYC_LEVEL_LABELS, REJECTION_REASONS } from "@/lib/labels";
import { formatMT } from "@/lib/money";
import { agentMerchantDetail, agentMerchantDevices } from "@/server/agent/queries";
import { agentProfile, assertAssigned, logAgentView, ONBOARDING_STEPS } from "@/server/agent/service";
import { requireApi, requirePage } from "@/server/auth/session";
import { openText, sealText } from "@/server/crypto";
import { getDb } from "@/server/db/client";
import { DomainError, publicMessage } from "@/server/errors";

export const metadata: Metadata = { title: "Ficha do comerciante" };

const attestations = {
  rosto_confirmado: "Rosto confirmado",
  banca_visitada: "Banca visitada",
  conhece_pessoa: "Conheço a pessoa",
  actividade_confirmada: "Actividade confirmada",
} as const;
const accountStatuses = { preliminar: "Registo inicial", activo: "Activo", suspenso: "Suspenso", encerrado: "Encerrado" };
const deviceStatuses = { em_stock: "Em stock", activo: "Activo", perdido: "Perdido", bloqueado: "Bloqueado", devolvido: "Devolvido" };
const leaseStatuses = { activo: "Activo", em_atraso: "Em atraso", concluido: "Concluído", cancelado: "Cancelado" };
const codeCookie = "uk_agent_activation";
type CodePreview = { actorId: string; merchantId: string; code: string; expiresAt: number };

/** A short encrypted preview lets the server render a large code without another client file or a code in the URL. */
async function generateEntryCode(merchantId: string, state: ActionState): Promise<ActionState> {
  "use server";
  try {
    const user = await requireApi(["agent"]);
    const result = await issueActivationCodeAction(merchantId, state);
    if (!result.code || result.error) return { error: result.error ?? "Não foi possível gerar o código." };
    const preview: CodePreview = { actorId: user.id, merchantId, code: result.code, expiresAt: Date.now() + 5 * 60_000 };
    (await cookies()).set(codeCookie, sealText(JSON.stringify(preview)), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/agente", maxAge: 300,
    });
    revalidatePath(`/agente/comerciantes/${merchantId}`);
    return { ok: true, message: "Código gerado. Partilha-o com o comerciante presente." };
  } catch (error) { return { error: publicMessage(error) }; }
}

async function hideEntryCode(merchantId: string): Promise<ActionState> {
  "use server";
  try {
    const user = await requireApi(["agent"]);
    const db = await getDb();
    const agent = await agentProfile(db, user.id);
    await assertAssigned(db, agent.id, merchantId);
    (await cookies()).set(codeCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/agente", maxAge: 0 });
    revalidatePath(`/agente/comerciantes/${merchantId}`);
    return { ok: true, message: "Código ocultado neste ecrã." };
  } catch (error) { return { error: publicMessage(error) }; }
}

async function advanceOnboarding(merchantId: string, step: number): Promise<ActionState> {
  "use server";
  return run(async () => {
    const user = await requireApi(["agent"]);
    const db = await getDb();
    const agent = await agentProfile(db, user.id);
    const detail = await agentMerchantDetail(db, agent.id, merchantId);
    await logAgentView(db, user, merchantId, "agente.registo.avancar");
    if (!detail || step !== detail.business.onboardingStep + 1 || step > ONBOARDING_STEPS.length) {
      throw new DomainError("registo", "Este passo já mudou. Actualiza a ficha antes de continuar.");
    }
    await onboardingStepAction(merchantId, step);
    return step === ONBOARDING_STEPS.length ? "Registo concluído." : "Passo concluído.";
  });
}

async function recordWithConfirmation(merchantId: string, state: ActionState, form: FormData): Promise<ActionState> {
  "use server";
  try {
    await requireApi(["agent"]);
    if (form.get("confirmed") !== "on") return { error: "Confirma o tipo e o valor com o comerciante." };
    return await assistedRecordAction(merchantId, state, form);
  } catch (error) { return { error: publicMessage(error) }; }
}

async function leaseWithConfirmation(merchantId: string, state: ActionState, form: FormData): Promise<ActionState> {
  "use server";
  try {
    const user = await requireApi(["agent"]);
    if (form.get("confirmed") !== "on") return { error: "Confirma as condições aprovadas com o comerciante." };
    const count = Number(form.get("instalments"));
    if (!Number.isSafeInteger(count) || count <= 0) return { error: "Indica um número inteiro de prestações." };
    const db = await getDb();
    const agent = await agentProfile(db, user.id);
    const { models } = await agentMerchantDevices(db, agent.id, merchantId);
    await logAgentView(db, user, merchantId, "agente.leasing.criar");
    if (!models.some((model) => model.id === form.get("modelId"))) return { error: "Escolhe um modelo disponível." };
    return await createLeaseAction(merchantId, state, form);
  } catch (error) { return { error: publicMessage(error) }; }
}

async function reportAssignedDeviceLost(merchantId: string, deviceId: string, state: ActionState, form: FormData): Promise<ActionState> {
  "use server";
  try {
    const user = await requireApi(["agent"]);
    if (form.get("confirmed") !== "on") return { error: "Confirma com o comerciante que este telefone foi perdido." };
    const db = await getDb();
    const agent = await agentProfile(db, user.id);
    const { phones } = await agentMerchantDevices(db, agent.id, merchantId);
    if (!phones.some((phone) => phone.id === deviceId && phone.status === "activo")) throw new DomainError("dispositivo", "Este telefone não está activo na conta deste comerciante.");
    await logAgentView(db, user, merchantId, "agente.dispositivo.perda");
    return await reportLostAction(deviceId, state);
  } catch (error) { return { error: publicMessage(error) }; }
}

export default async function AgentMerchantPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage(["agent"], "/agente/comerciantes");
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const db = await getDb();
  const agent = await agentProfile(db, user.id);
  try { await assertAssigned(db, agent.id, id); }
  catch (error) {
    if (error instanceof DomainError && error.code === "sem_permissao") notFound();
    throw error;
  }
  await logAgentView(db, user, id, "agente.ficha");
  const [merchant, equipment] = await Promise.all([agentMerchantDetail(db, agent.id, id), agentMerchantDevices(db, agent.id, id)]);
  if (!merchant) notFound();
  const sealedPreview = (await cookies()).get(codeCookie)?.value;
  let code: string | null = null;
  if (sealedPreview) {
    try {
      const preview: CodePreview = JSON.parse(openText(sealedPreview));
      if (preview.actorId === user.id && preview.merchantId === id && preview.expiresAt > Date.now() && /^\d{8}$/.test(preview.code)) code = preview.code;
    } catch { /* Expired or unreadable previews do not prevent access to the dossier. */ }
  }
  const step = Math.max(0, Math.min(ONBOARDING_STEPS.length, merchant.business.onboardingStep));
  return <>
    <PageHead eyebrow={merchant.marketName} title={merchant.name} lead={merchant.business.name}
      actions={<Link href="/agente/comerciantes" className="btn btn-ghost">Voltar à carteira</Link>} />
    <section className="card stack block" style={{ overflowWrap: "anywhere" }}>
      <div className="row-between wrap"><h2 className="card-title">O negócio</h2><Badge tone={merchant.status === "activo" ? "good" : "warn"}>{accountStatuses[merchant.status]}</Badge></div>
      <dl className="stack small"><div><dt className="muted">Actividade</dt><dd>{merchant.business.activity}</dd></div><div><dt className="muted">Banca</dt><dd>{merchant.business.stall ?? "Por indicar"}</dd></div><div><dt className="muted">Telefone</dt><dd>{merchant.phone ?? "Por indicar"}</dd></div></dl>
      <p className="tiny muted">O teu acesso fica registado no histórico do comerciante.</p>
    </section>

    <section className="card stack block" aria-labelledby="entry-title">
      <SectionTitle title="Entrada na conta" />
      <p id="entry-title" className="small">O comerciante entra com o número de telefone e este código, e cria o seu PIN.</p>
      {code ? <div className="stack" role="status"><span className="tiny muted">Código acabado de gerar</span><output aria-label="Código de entrada" className="num" style={{ fontSize: "clamp(1.8rem, 8vw, 3.2rem)", fontWeight: 700, letterSpacing: ".08em", overflowWrap: "anywhere" }}>{code.slice(0, 4)} {code.slice(4)}</output><ActionForm action={hideEntryCode.bind(null, id)}><SubmitButton className="btn btn-ghost">Ocultar código</SubmitButton></ActionForm></div> : null}
      <ActionForm action={generateEntryCode.bind(null, id)}><SubmitButton>{code ? "Gerar novo código de entrada" : "Gerar código de entrada"}</SubmitButton></ActionForm>
      <p className="hint">Partilha o código apenas com o comerciante presente. Um novo código substitui o anterior. O PIN é escolhido pelo comerciante e fica só com ele.</p>
    </section>

    <section className="card stack block">
      <SectionTitle title="Passos do registo" /><p className="small muted">{step} de {ONBOARDING_STEPS.length} passos concluídos. Confirma cada passo com a pessoa.</p>
      <ol className="step-list">{ONBOARDING_STEPS.map((label, index) => <li key={label} data-done={index < step} aria-current={index === step ? "step" : undefined}>
        <i aria-hidden="true">{index < step ? "✓" : index + 1}</i><span className="grow">{label}{index < step ? <span className="tiny muted"> · Feito</span> : null}</span>
      </li>)}</ol>
      {step < ONBOARDING_STEPS.length ? <ActionForm action={advanceOnboarding.bind(null, id, step + 1)}><p className="small">Já concluíram «{ONBOARDING_STEPS[step]}»?</p><SubmitButton>{step + 1 === ONBOARDING_STEPS.length ? "Concluir registo" : "Confirmar e avançar"}</SubmitButton></ActionForm> : <Badge tone="good">Registo concluído</Badge>}
    </section>

    <section className="card stack block">
      <div className="row-between wrap"><h2 className="card-title">Identidade e documentos</h2><Badge tone={merchant.level ? "good" : "warn"}>{KYC_LEVEL_LABELS[merchant.level] ?? `Nível ${merchant.level}`}</Badge></div>
      <p className="small muted">Submete a evidência aplicável. A equipa de revisão decide; quem submete não pode aprovar.</p>
      {!merchant.documents.length ? <EmptyState title="Ainda sem documentos" icon="document">Combina com o comerciante a recolha dos documentos aplicáveis à verificação.</EmptyState> : <ul className="stack" style={{ listStyle: "none", padding: 0 }}>{merchant.documents.map((document) => <li key={document.id} className="stack" style={{ borderBottom: "1px solid var(--line)", paddingBlock: 10, overflowWrap: "anywhere" }}>
        <div className="row-between wrap"><strong className="small">{DOCUMENT_TYPES[document.type] ?? document.type}</strong><Badge tone={document.status === "aprovado" ? "good" : document.status === "rejeitado" || document.status === "expirado" ? "bad" : "warn"}>{DOCUMENT_STATUS_LABELS[document.status]}</Badge></div>
        <p className="tiny muted">Versão {document.version}{document.numberMasked ? ` · ${document.numberMasked}` : ""}{document.submittedAt ? ` · ${formatDateTime(document.submittedAt)}` : ""}</p>
        {document.rejectionReason ? <p className="small">{REJECTION_REASONS[document.rejectionReason] ?? document.rejectionReason}{document.rejectionNote ? ` · ${document.rejectionNote}` : ""}</p> : null}
      </li>)}</ul>}
      <details><summary className="row" style={{ minHeight: 44, cursor: "pointer", fontWeight: 650 }}>Submeter documento</summary>
        <ActionForm action={agentDocumentAction.bind(null, id)} className="stack block">
          <label className="field"><span className="label">Tipo de documento</span><select className="select" name="type" required defaultValue=""><option value="" disabled>Escolhe o tipo aplicável</option>{Object.entries(DOCUMENT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field"><span className="label">Número do documento (opcional)</span><input className="input" name="number" maxLength={80} autoComplete="off" /></label>
          <label className="field"><span className="label">Fotografia ou PDF legível</span><input className="input" type="file" name="file" accept="image/*,application/pdf" capture="environment" required /><span className="hint">Confirma que o documento está completo e que todos os dados se lêem.</span></label>
          <SubmitButton>Enviar para revisão</SubmitButton>
        </ActionForm>
      </details>
    </section>

    <details className="card block"><summary style={{ minHeight: 44, cursor: "pointer", fontWeight: 650 }}>Atestar o que confirmaste</summary><div className="stack" style={{ marginTop: 12 }}>
      <p className="small muted">Regista apenas o que confirmaste pessoalmente. O teu testemunho fica identificado.</p>
      <ActionForm action={attestAction.bind(null, id)}>
        <fieldset className="stack" style={{ border: 0, padding: 0, minWidth: 0 }}><legend className="label">O que confirmaste nesta visita?</legend>{Object.entries(attestations).map(([kind, label]) => <label className="check" key={kind} style={{ minHeight: 44, alignItems: "center" }}><input type="radio" name="kind" value={kind} required /><span>{label}</span></label>)}</fieldset>
        <label className="field"><span className="label">Nota (opcional)</span><textarea className="textarea" name="note" rows={2} maxLength={1000} /></label><SubmitButton>Registar confirmação</SubmitButton>
      </ActionForm>
      {merchant.attestations.length ? <div className="stack"><h3 className="card-title">Confirmações registadas</h3>{merchant.attestations.map((attestation) => <div key={attestation.id}><p className="small"><strong>{attestation.kind in attestations ? attestations[attestation.kind as keyof typeof attestations] : "Morada referida"}</strong> · {attestation.source === "observado" ? "Observado" : "Declarado"}</p><p className="tiny muted">{formatDateTime(attestation.createdAt)}</p>{attestation.note ? <p className="small" style={{ overflowWrap: "anywhere" }}>{attestation.note}</p> : null}</div>)}</div> : null}
    </div></details>

    <details className="card block"><summary style={{ minHeight: 44, cursor: "pointer", fontWeight: 650 }}>Ajudar num registo</summary><div className="stack" style={{ marginTop: 12 }}>
      <p className="small muted">Este registo fica em nome do comerciante, com a tua identificação.</p>
      <ActionForm action={recordWithConfirmation.bind(null, id)}>
        <label className="field"><span className="label">Tipo de registo</span><select className="select" name="kind" defaultValue="venda" required><option value="venda">Venda</option><option value="despesa">Despesa</option></select></label>
        <label className="field"><span className="label">Valor em MT</span><input className="input" name="amount" inputMode="decimal" autoComplete="off" required maxLength={24} /></label>
        <label className="field"><span className="label">Descrição (opcional)</span><input className="input" name="memo" maxLength={300} /></label>
        <label className="check" style={{ minHeight: 44, paddingBlock: 8 }}><input name="confirmed" type="checkbox" required /><span>Confirmei o tipo e o valor com o comerciante.</span></label><SubmitButton>Confirmar registo</SubmitButton>
      </ActionForm>
    </div></details>

    <details className="card block"><summary style={{ minHeight: 44, cursor: "pointer", fontWeight: 650 }}>Registar visita</summary>
      <ActionForm action={logVisitAction.bind(null, id)} className="stack" ><div className="field" style={{ marginTop: 12 }}><label htmlFor="visit-purpose">Motivo da visita</label><input className="input" id="visit-purpose" name="purpose" minLength={2} maxLength={200} required /></div>
        <label className="field"><span className="label">Resultado</span><input className="input" name="outcome" minLength={2} maxLength={200} required /></label>
        <label className="field"><span className="label">Nota (opcional)</span><textarea className="textarea" name="note" rows={3} maxLength={2000} /></label><SubmitButton>Guardar visita</SubmitButton>
      </ActionForm>
    </details>

    <details className="card block"><summary style={{ minHeight: 44, cursor: "pointer", fontWeight: 650 }}>Abrir incidente</summary>
      <ActionForm action={openIncidentAction.bind(null, id)} className="stack"><label className="field" style={{ marginTop: 12 }}><span className="label">Tipo de apoio</span><select className="select" name="kind" defaultValue="suporte">{Object.entries(INCIDENT_KIND_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
        <label className="field"><span className="label">O que aconteceu?</span><input className="input" name="title" required minLength={4} maxLength={200} /></label>
        <label className="field"><span className="label">Detalhes para quem vai ajudar</span><textarea className="textarea" name="description" rows={3} maxLength={2000} required /></label><SubmitButton>Abrir pedido de apoio</SubmitButton>
      </ActionForm>
    </details>

    <section className="card stack block"><SectionTitle title="Telefone e leasing" />
      {!equipment.phones.length ? <p className="small muted">Ainda sem telefone associado.</p> : equipment.phones.map((phone) => <article className="stack" key={phone.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 12, overflowWrap: "anywhere" }}>
        <div className="row-between wrap"><strong>{phone.modelName ?? phone.label}</strong><Badge tone={phone.status === "activo" ? "good" : "warn"}>{deviceStatuses[phone.status]}</Badge></div>
        {phone.serial ? <p className="tiny muted">Série: {phone.serial}</p> : null}<p className="tiny muted">{phone.lastSyncAt ? `Última sincronização: ${formatDateTime(phone.lastSyncAt)}` : "Ainda sem sincronização"}</p>
        {phone.status === "activo" ? <details><summary style={{ minHeight: 44, cursor: "pointer" }}>Reportar perda deste telefone</summary><ActionForm action={reportAssignedDeviceLost.bind(null, id, phone.id)}><p className="small">O telefone é bloqueado e as sessões desse telefone terminam. A cópia local será apagada quando voltar à rede.</p><label className="check" style={{ minHeight: 44, paddingBlock: 8 }}><input type="checkbox" name="confirmed" required /><span>O comerciante confirmou a perda deste telefone.</span></label><SubmitButton className="btn btn-danger">Confirmar perda e bloquear</SubmitButton></ActionForm></details> : null}
      </article>)}
      {equipment.leases.map((lease) => <article key={lease.id} className="stack"><div className="row-between wrap"><strong className="small">{lease.code}</strong><Badge tone={lease.status === "em_atraso" ? "bad" : "neutral"}>{leaseStatuses[lease.status]}</Badge></div><p className="small">{lease.instalments} prestações de {formatMT(lease.instalmentCents)} · {lease.frequency === "semanal" ? "Semanais" : "Mensais"}</p>{lease.pendingTerms ? <p className="hint">Condições por validar pela gestão.</p> : null}</article>)}
      {equipment.models.length ? <details><summary style={{ minHeight: 44, cursor: "pointer", fontWeight: 650 }}>Associar telefone em leasing</summary>
        <ActionForm action={leaseWithConfirmation.bind(null, id)} className="stack"><p className="small muted" style={{ marginTop: 12 }}>Usa as condições aprovadas pela gestão. Explica ao comerciante o valor, a frequência e o número de prestações antes de confirmar.</p>
          <label className="field"><span className="label">Modelo do telefone</span><select className="select" name="modelId" required defaultValue=""><option value="" disabled>Escolhe um modelo disponível</option>{equipment.models.map((model) => <option value={model.id} key={model.id}>{model.name}{model.specs ? ` · ${model.specs}` : ""}</option>)}</select></label>
          <label className="field"><span className="label">Número de série (opcional)</span><input className="input" name="serial" maxLength={100} /></label>
          <label className="field"><span className="label">Prestação semanal aprovada, em MT</span><input className="input" name="instalment" inputMode="decimal" required maxLength={24} /></label>
          <label className="field"><span className="label">Número aprovado de prestações</span><input className="input" name="instalments" type="number" inputMode="numeric" min={1} step={1} required /></label>
          <label className="check" style={{ minHeight: 44, paddingBlock: 8 }}><input type="checkbox" name="confirmed" required /><span>Confirmei com o comerciante as condições aprovadas pela gestão.</span></label><SubmitButton>Confirmar telefone e leasing</SubmitButton>
        </ActionForm>
      </details> : <p className="hint">A gestão ainda não disponibilizou modelos de telefone.</p>}
    </section>
  </>;
}
