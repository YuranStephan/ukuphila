import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { analyseAction, decideAction } from "@/actions/credit";
import { TrustPanel } from "@/components/console/merchant-dossier";
import { ActionForm } from "@/components/forms";
import { Badge, ExampleTag, PageHead, SectionTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { APPLICATION_LABELS, CREDIT_REASON_CODES } from "@/lib/labels";
import { formatMT } from "@/lib/money";
import { applicationDetail } from "@/server/admin/queries";
import { can } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";
import { activePolicy } from "@/server/credit/service";
import { getDb } from "@/server/db/client";
import { logAccess } from "@/server/kyc/service";

export const metadata: Metadata = { title: "Pedido de crédito" };

function Reasons() {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack">
      <legend className="label" style={{ marginBottom: 6 }}>
        Motivos
      </legend>
      <div className="row wrap" style={{ ["--gap" as string]: "10px" }}>
        {Object.entries(CREDIT_REASON_CODES).map(([key, label]) => (
          <label key={key} className="check" style={{ fontSize: "0.86rem" }}>
            <input type="checkbox" name="reason" value={key} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("credit.read");
  const { id } = await params;
  const db = await getDb();
  const [detail, policy] = await Promise.all([applicationDetail(db, id), activePolicy(db)]);
  if (!detail) notFound();
  const { application, name, supplierName, decisions, trust } = detail;
  await logAccess(db, user, application.userId, "Análise de crédito", `Pedido ${application.code}`);
  const canAnalyse = can(user.role, "credit.analyse") && ["submetido", "em_analise"].includes(application.status);
  const canDecide = can(user.role, "credit.approve") && application.status === "recomendado";
  return (
    <>
      <PageHead eyebrow={application.code} title={name} lead={`Pedido a ${supplierName}. A IA não participa nesta decisão.`} actions={<Badge tone="info">{APPLICATION_LABELS[application.status]}</Badge>} />
      <div className="grid-2">
        <TrustPanel trust={trust} />
        <div className="stack">
          <section className="card">
            <SectionTitle title="O pedido" action={policy?.params.isExample ? <ExampleTag>Política de exemplo</ExampleTag> : null} />
            <dl className="kv">
              {application.items.map((item) => (
                <div key={item.name}>
                  <dt>
                    {item.quantity} {item.unit} de {item.name}
                  </dt>
                  <dd className="num">{formatMT(item.quantity * item.priceCents)}</dd>
                </div>
              ))}
              <div>
                <dt>Total pedido</dt>
                <dd className="num">{formatMT(application.requestedCents)}</dd>
              </div>
              {application.offeredCents ? (
                <div>
                  <dt>Proposta</dt>
                  <dd className="num">
                    {formatMT(application.offeredCents)} em {application.offeredTermDays} dias
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
          {canAnalyse ? (
            <section className="card">
              <SectionTitle title="Análise" />
              <ActionForm action={analyseAction.bind(null, application.id)}>
                <Reasons />
                <div className="row wrap">
                  <div className="field grow">
                    <label htmlFor="offered">Valor proposto (MT)</label>
                    <input id="offered" className="input num" name="offered" defaultValue={application.requestedCents / 100} />
                  </div>
                  <div className="field grow">
                    <label htmlFor="termDays">Prazo</label>
                    <select id="termDays" className="select" name="termDays">
                      {policy?.params.termOptionsDays.map((days) => (
                        <option key={days} value={days}>
                          {days} dias
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field grow">
                    <label htmlFor="instalments">Prestações</label>
                    <input id="instalments" className="input num" name="instalments" type="number" min={1} max={12} defaultValue={2} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="note">Explica a decisão</label>
                  <textarea id="note" className="textarea" name="note" required minLength={10} />
                </div>
                <div className="row wrap">
                  <button className="btn btn-primary" type="submit" name="outcome" value="recomenda">
                    Recomendar
                  </button>
                  <button className="btn btn-ghost" type="submit" name="outcome" value="recusa">
                    Recusar
                  </button>
                </div>
              </ActionForm>
            </section>
          ) : null}
          {canDecide ? (
            <section className="card">
              <SectionTitle title="Aprovação" />
              <p className="small muted" style={{ marginBottom: 10 }}>
                Só uma pessoa diferente de quem recomendou pode decidir.
              </p>
              <ActionForm action={decideAction.bind(null, application.id)}>
                <Reasons />
                <div className="field">
                  <label htmlFor="note">Explica a decisão</label>
                  <textarea id="note" className="textarea" name="note" required minLength={10} />
                </div>
                <div className="row wrap">
                  <button className="btn btn-primary" type="submit" name="outcome" value="aprova">
                    Aprovar
                  </button>
                  <button className="btn btn-ghost" type="submit" name="outcome" value="recusa">
                    Recusar
                  </button>
                </div>
              </ActionForm>
            </section>
          ) : null}
          <section className="card">
            <SectionTitle title="Histórico da decisão" />
            {decisions.length === 0 ? <p className="small muted">Ainda sem decisões.</p> : null}
            {decisions.map(({ decision, name: actor }) => (
              <div key={decision.id} style={{ padding: "8px 0" }}>
                <p className="small">
                  <strong>{actor}</strong> · {decision.outcome}
                  <span className="muted"> · {formatDateTime(decision.createdAt)}</span>
                </p>
                <p className="small muted">{decision.note}</p>
                <div className="row wrap" style={{ ["--gap" as string]: "5px", marginTop: 4 }}>
                  {decision.reasonCodes.map((code) => (
                    <Badge key={code}>{CREDIT_REASON_CODES[code] ?? code}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
