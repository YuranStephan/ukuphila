import type { Metadata } from "next";
import { saveAgentRatesAction, saveOfflinePolicyAction, saveOrganisationAction, saveTrustPolicyAction } from "@/actions/gestao";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHead, SectionTitle } from "@/components/ui";
import { can } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getSetting } from "@/server/settings";

export const metadata: Metadata = { title: "Definições" };

function Num({ name, label, value, suffix }: { name: string; label: string; value: number; suffix?: string }) {
  return (
    <div className="field">
      <label htmlFor={name}>
        {label}
        {suffix ? <span className="muted"> ({suffix})</span> : null}
      </label>
      <input id={name} className="input num" name={name} type="number" step="any" defaultValue={value} required />
    </div>
  );
}

export default async function SettingsPage() {
  const user = await requirePage("ops.read");
  const db = await getDb();
  const [organisation, trust, offline, rates] = await Promise.all([getSetting(db, "organisation"), getSetting(db, "trustPolicy"), getSetting(db, "offlinePolicy"), getSetting(db, "agentRates")]);
  const editable = can(user.role, "settings.manage");
  return (
    <>
      <PageHead eyebrow="Governação" title="Definições" lead="Regras de trabalho do programa. Cada alteração fica na auditoria." />
      <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="grid-even">
          <section className="card">
            <SectionTitle title="Regras dos anéis" />
            <ActionForm action={saveTrustPolicyAction}>
              <div className="field">
                <label htmlFor="version">Versão</label>
                <input id="version" className="input" name="version" defaultValue={trust.version} required />
              </div>
              <Num name="ring2" label="Anel 2: dias com registo em 14" value={trust.ring2.activeDays14} />
              <Num name="ring3" label="Anel 3: dias com registo em 30" value={trust.ring3.activeDays30} />
              <Num name="ring3Kyc" label="Anel 3: nível de verificação" value={trust.ring3.minKycLevel} />
              <Num name="ring4Months" label="Anel 4: meses de historial" value={trust.ring4.minMonths} />
              <Num name="ring4Days" label="Anel 4: dias com registo em 90" value={trust.ring4.activeDays90} />
              <Num name="ring4Kyc" label="Anel 4: nível de verificação" value={trust.ring4.minKycLevel} />
              <Num name="ring4Savings" label="Anel 4: meses com poupança em 6" value={trust.ring4.minSavingsMonths} />
              <Num name="ring4Punctuality" label="Anel 4: pontualidade no Xitique" value={Math.round(trust.ring4.minXitiquePunctuality * 100)} suffix="%" />
              <SubmitButton>Guardar</SubmitButton>
            </ActionForm>
          </section>
          <div className="stack">
            <section className="card">
              <SectionTitle title="Registos sem rede" />
              <ActionForm action={saveOfflinePolicyAction}>
                <Num name="maxOp" label="Valor máximo por registo" value={offline.maxOpCents / 100} suffix="MT" />
                <Num name="maxPending" label="Total pendente no telefone" value={offline.maxPendingCents / 100} suffix="MT" />
                <Num name="maxAge" label="Idade máxima" value={offline.maxAgeDays} suffix="dias" />
                <SubmitButton>Guardar</SubmitButton>
              </ActionForm>
            </section>
            <section className="card">
              <SectionTitle title="Comissões de agentes" />
              <ActionForm action={saveAgentRatesAction}>
                <Num name="onboarding" label="Por registo" value={rates.onboardingCents / 100} suffix="MT" />
                <Num name="kyc" label="Por verificação concluída" value={rates.kycCompleteCents / 100} suffix="MT" />
                <Num name="activation" label="Por activação a 30 dias" value={rates.activation30dCents / 100} suffix="MT" />
                <SubmitButton>Guardar</SubmitButton>
              </ActionForm>
            </section>
            <section className="card">
              <SectionTitle title="Organização" />
              <ActionForm action={saveOrganisationAction}>
                <div className="field">
                  <label htmlFor="legalEntity">Entidade jurídica</label>
                  <input id="legalEntity" className="input" name="legalEntity" defaultValue={organisation.legalEntity} placeholder="Por definir" />
                </div>
                <div className="field">
                  <label htmlFor="supportWhatsapp">WhatsApp de apoio</label>
                  <input id="supportWhatsapp" className="input" name="supportWhatsapp" defaultValue={organisation.supportWhatsapp} />
                </div>
                <div className="field">
                  <label htmlFor="supportPhone">Telefone de apoio</label>
                  <input id="supportPhone" className="input" name="supportPhone" defaultValue={organisation.supportPhone} />
                </div>
                <div className="field">
                  <label htmlFor="supportEmail">Email de apoio</label>
                  <input id="supportEmail" className="input" name="supportEmail" defaultValue={organisation.supportEmail} />
                </div>
                <SubmitButton>Guardar</SubmitButton>
              </ActionForm>
            </section>
          </div>
        </div>
      </fieldset>
    </>
  );
}
