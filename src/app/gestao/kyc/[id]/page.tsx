import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { reviewDocumentAction } from "@/actions/gestao";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, PageHead, SectionTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPES, REJECTION_REASONS } from "@/lib/labels";
import { documentDetail } from "@/server/admin/queries";
import { can } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Revisão de documento" };

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("merchant.read");
  const { id } = await params;
  const row = await documentDetail(await getDb(), id);
  if (!row) notFound();
  const { document, name } = row;
  const canView = can(user.role, "document.view");
  const canReview = can(user.role, "kyc.review") && ["submetido", "em_revisao"].includes(document.status);
  return (
    <>
      <PageHead eyebrow="Revisão" title={DOCUMENT_TYPES[document.type] ?? document.type} lead={`${name} · versão ${document.version}. Abrir o ficheiro fica registado e o comerciante pode ver.`} actions={<Badge tone={document.status === "aprovado" ? "good" : document.status === "rejeitado" ? "bad" : "warn"}>{DOCUMENT_STATUS_LABELS[document.status]}</Badge>} />
      <div className="grid-2">
        <section className="card">
          <SectionTitle title="Ficheiro" />
          {canView ? (
            <div className="doc-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/documents/${document.id}`} alt={`${DOCUMENT_TYPES[document.type]} de ${name}`} />
            </div>
          ) : (
            <p className="muted small">A tua função não permite abrir documentos.</p>
          )}
          <dl className="kv" style={{ marginTop: 12 }}>
            <div>
              <dt>Número</dt>
              <dd className="mono">{document.numberMasked ?? "—"}</dd>
            </div>
            <div>
              <dt>Submetido</dt>
              <dd>{document.submittedAt ? formatDateTime(document.submittedAt) : "—"}</dd>
            </div>
            <div>
              <dt>Impressão digital</dt>
              <dd className="hash">{document.sha256?.slice(0, 16)}…</dd>
            </div>
            <div>
              <dt>Cifra</dt>
              <dd>AES-256-GCM · chave {document.keyId}</dd>
            </div>
          </dl>
        </section>
        <section className="card">
          <SectionTitle title="Decisão" />
          {canReview ? (
            <ActionForm action={reviewDocumentAction.bind(null, document.id)}>
              <div className="field">
                <label htmlFor="reason">Motivo, se rejeitares</label>
                <select id="reason" className="select" name="reason" defaultValue="">
                  <option value="">Escolhe o motivo</option>
                  {Object.entries(REJECTION_REASONS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="note">Nota para o agente</label>
                <textarea id="note" className="textarea" name="note" />
              </div>
              <div className="row wrap">
                <button className="btn btn-primary" type="submit" name="outcome" value="aprovar">
                  Aprovar
                </button>
                <button className="btn btn-ghost" type="submit" name="outcome" value="rejeitar">
                  Rejeitar
                </button>
                <span style={{ display: "none" }}>
                  <SubmitButton>.</SubmitButton>
                </span>
              </div>
            </ActionForm>
          ) : document.reviewedAt ? (
            <dl className="kv">
              <div>
                <dt>Revisto em</dt>
                <dd>{formatDateTime(document.reviewedAt)}</dd>
              </div>
              {document.rejectionReason ? (
                <div>
                  <dt>Motivo</dt>
                  <dd>{REJECTION_REASONS[document.rejectionReason]}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="muted small">Só a equipa de revisão pode decidir.</p>
          )}
        </section>
      </div>
    </>
  );
}
