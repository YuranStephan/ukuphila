import type { Metadata } from "next";
import { onboardAction } from "@/actions/agent";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHead, SectionTitle } from "@/components/ui";
import { CONSENT_PURPOSES } from "@/lib/labels";
import { agentProfile } from "@/server/agent/service";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Novo comerciante" };

export default async function NewMerchantPage() {
  const user = await requirePage(["agent"], "/agente/novo");
  const agent = await agentProfile(await getDb(), user.id);
  return <>
    <PageHead eyebrow={agent.marketName} title="Vamos conhecer o negócio" lead="Apresenta o Ukuphila e lê os consentimentos com o comerciante. Depois do perfil, continuam juntos os passos do registo." />
    <ActionForm action={onboardAction}>
      <section className="card stack"><SectionTitle title="A pessoa e o negócio" />
        <label className="field"><span className="label">Número de telefone</span><input className="input" name="phone" type="tel" inputMode="tel" autoComplete="tel" required minLength={9} maxLength={20} /><span className="hint">O telemóvel de Moçambique com que o comerciante vai entrar.</span></label>
        <label className="field"><span className="label">Nome pelo qual a pessoa é conhecida</span><input className="input" name="displayName" autoComplete="name" required minLength={2} maxLength={60} /></label>
        <label className="field"><span className="label">Nome do negócio</span><input className="input" name="businessName" autoComplete="organization" required minLength={2} maxLength={60} /></label>
        <label className="field"><span className="label">Actividade do negócio</span><input className="input" name="activity" required minLength={2} maxLength={60} /></label>
        <label className="field"><span className="label">Banca ou ponto de referência</span><input className="input" name="stall" maxLength={60} /><span className="hint">Opcional. O mercado fica associado à tua carteira.</span></label>
      </section>
      <section className="card stack"><SectionTitle title="O comerciante escolhe" /><p className="small">Explica cada consentimento e confirma que a pessoa compreendeu antes de assinalar.</p>
        <label className="check" style={{ minHeight: 44, paddingBlock: 10 }}><input type="checkbox" name="consent_base" required /><span><strong>Quero usar o Ukuphila e verificar a minha identidade</strong>{["servico_base", "verificacao"].map((key) => <span className="small muted" style={{ display: "block" }} key={key}>{CONSENT_PURPOSES[key].label}: {CONSENT_PURPOSES[key].detail}</span>)}</span></label>
        <p className="small muted">As escolhas abaixo são opcionais. A pessoa pode usar o serviço sem as aceitar e pode retirar estes consentimentos nas definições.</p>
        {["voz_ia", "historial_credito", "estudos"].map((key) => <label className="check" key={key} style={{ minHeight: 44, paddingBlock: 10 }}><input name={key} type="checkbox" /><span><strong>{CONSENT_PURPOSES[key].label}</strong><span className="small muted" style={{ display: "block" }}>{CONSENT_PURPOSES[key].detail}</span></span></label>)}
      </section>
      <SubmitButton>Criar perfil e continuar</SubmitButton>
    </ActionForm>
  </>;
}
