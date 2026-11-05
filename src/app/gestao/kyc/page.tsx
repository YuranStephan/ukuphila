import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, PageHead, Stat } from "@/components/ui";
import { formatDateTime, relativeTime } from "@/lib/dates";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPES, REJECTION_REASONS } from "@/lib/labels";
import { listDocuments } from "@/server/admin/queries";
import { programmeKpis } from "@/server/analytics/programme";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "KYC e documentos" };

export default async function KycPage() {
  await requirePage("merchant.read");
  const db = await getDb();
  const [queue, decided, kpis] = await Promise.all([listDocuments(db, "fila"), listDocuments(db, "decididos"), programmeKpis(db)]);
  return (
    <>
      <PageHead eyebrow="Decisões" title="KYC e documentos" lead="Quem submete um documento nunca o pode aprovar. Cada decisão fica com responsável, hora e motivo." />
      <div className="stat-grid">
        <Stat tone="sun" icon="document" label="Na fila" value={queue.length} />
        <Stat icon="sync" label="Tempo médio de revisão" value={`${kpis.kycHours} h`} />
        <Stat icon="check" label="Decididos" value={decided.length} hint="Últimos 60" />
      </div>
      <section className="card card-flush block">
        {queue.length === 0 ? (
          <EmptyState title="Fila vazia" icon="check">
            Não há documentos à espera de revisão.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Comerciante</th>
                  <th>Documento</th>
                  <th>Mercado</th>
                  <th>Submetido</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(({ document, name, market }) => (
                  <tr key={document.id}>
                    <td>
                      <Link href={`/gestao/kyc/${document.id}`}>{name}</Link>
                    </td>
                    <td>
                      {DOCUMENT_TYPES[document.type] ?? document.type}
                      {document.version > 1 ? <span className="muted"> · versão {document.version}</span> : null}
                    </td>
                    <td>{market}</td>
                    <td className="muted">{document.submittedAt ? relativeTime(document.submittedAt) : "—"}</td>
                    <td>
                      <Badge tone="warn">{DOCUMENT_STATUS_LABELS[document.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <h2 className="card-title" style={{ margin: "22px 0 10px" }}>
        Decisões recentes
      </h2>
      <section className="card card-flush">
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {decided.slice(0, 14).map(({ document, name }) => (
                <tr key={document.id}>
                  <td>
                    <Link href={`/gestao/kyc/${document.id}`}>{name}</Link>
                  </td>
                  <td>{DOCUMENT_TYPES[document.type] ?? document.type}</td>
                  <td>
                    <Badge tone={document.status === "aprovado" ? "good" : "bad"}>{DOCUMENT_STATUS_LABELS[document.status]}</Badge>
                    {document.rejectionReason ? <span className="tiny muted"> {REJECTION_REASONS[document.rejectionReason]}</span> : null}
                  </td>
                  <td className="muted">{document.reviewedAt ? formatDateTime(document.reviewedAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
