import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyLedgerAction } from "@/actions/gestao";
import { DossierBody } from "@/components/console/merchant-dossier";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHead } from "@/components/ui";
import { formatPhone } from "@/lib/phone";
import { merchantDossier } from "@/server/admin/queries";
import { can } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { logAccess } from "@/server/kyc/service";

export const metadata: Metadata = { title: "Comerciante" };

export default async function MerchantPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("merchant.read");
  const { id } = await params;
  const db = await getDb();
  const dossier = await merchantDossier(db, id);
  if (!dossier) notFound();
  await logAccess(db, user, id, "Consulta na gestão", "Perfil do comerciante");
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
      <DossierBody dossier={dossier} />
    </>
  );
}
