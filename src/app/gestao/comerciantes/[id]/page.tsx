import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { verifyLedgerAction } from "@/actions/gestao";
import { assignMerchantAction } from "@/actions/people";
import { ActivationCode } from "@/components/console/activation-code";
import { DossierBody } from "@/components/console/merchant-dossier";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHead } from "@/components/ui";
import { formatPhone } from "@/lib/phone";
import { merchantDossier } from "@/server/admin/queries";
import { can } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { agents, users } from "@/server/db/schema";
import { logAccess } from "@/server/kyc/service";

export const metadata: Metadata = { title: "Comerciante" };

export default async function MerchantPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("merchant.read");
  const { id } = await params;
  const db = await getDb();
  const dossier = await merchantDossier(db, id);
  if (!dossier) notFound();
  await logAccess(db, user, id, "Consulta na gestão", "Perfil do comerciante");
  const availableAgents = can(user.role, "team.manage") ? await db.select({ id: agents.id, name: users.displayName }).from(agents).innerJoin(users, eq(users.id, agents.userId)).where(and(eq(agents.marketId, dossier.business.marketId), eq(agents.status, "activo"))).orderBy(users.displayName) : [];
  return (
    <>
      <PageHead
        eyebrow={dossier.business.name}
        title={dossier.user.displayName}
        lead={`${formatPhone(dossier.user.phone)} · Esta consulta ficou registada e o comerciante pode vê-la.`}
        actions={
          can(user.role, "ledger.read") ? (
            <ActionForm action={verifyLedgerAction.bind(null, id)} className="row">
              <SubmitButton className="btn btn-ghost btn-s">Verificar integridade do registo</SubmitButton>
            </ActionForm>
          ) : null
        }
      />
      {can(user.role, "team.manage") ? <section className="card block" style={{ marginBottom: 14 }}><h2 className="card-title">Acompanhamento e acesso</h2><div className="grid-even block"><div>{availableAgents.length ? <ActionForm action={assignMerchantAction.bind(null, id)}><label className="field"><span className="label">Agente no mercado</span><select className="select" name="agentId" defaultValue={dossier.business.agentId ?? ""} required><option value="" disabled>Escolher agente</option>{availableAgents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></label><SubmitButton>Atribuir agente</SubmitButton></ActionForm> : <p className="small muted">Ainda não há agentes activos neste mercado. <Link href="/gestao/agentes">Criar agente</Link></p>}</div><div><ActivationCode userId={id} /></div></div></section> : null}
      <DossierBody dossier={dossier} />
    </>
  );
}
