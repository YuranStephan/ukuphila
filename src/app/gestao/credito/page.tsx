import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHead, Stat, type Tone } from "@/components/ui";
import { relativeTime } from "@/lib/dates";
import { APPLICATION_LABELS } from "@/lib/labels";
import { formatMT } from "@/lib/money";
import { listApplications } from "@/server/admin/queries";
import { creditPipeline, repaymentStats } from "@/server/analytics/programme";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Crédito" };

const APP_TONE: Record<string, Tone> = { submetido: "warn", em_analise: "warn", recomendado: "info", aprovado: "good", aceite: "good", recusado: "bad", desistido: "neutral", expirado: "neutral" };

export default async function CreditPage() {
  await requirePage("credit.read");
  const db = await getDb();
  const [rows, pipeline, repayments] = await Promise.all([listApplications(db), creditPipeline(db), repaymentStats(db)]);
  const count = (...statuses: string[]) => pipeline.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row.total, 0);
  return (
    <>
      <PageHead eyebrow="Decisões" title="Crédito fornecedor" lead="O crédito nunca é automático: a análise recomenda, outra pessoa aprova e o comerciante aceita com o seu PIN." />
      <div className="stat-grid">
        <Stat tone="sun" icon="document" label="Por analisar" value={count("submetido", "em_analise")} />
        <Stat icon="users" label="Por aprovar" value={count("recomendado")} hint="Precisa de outra pessoa" />
        <Stat icon="check" label="Aceites" value={count("aceite")} />
        <Stat icon="x" label="Recusados" value={count("recusado")} />
        <Stat icon="coins" label="Pagamentos recebidos" value={formatMT(repayments.collectedCents)} hint={`${repayments.settled} contratos liquidados`} />
      </div>
      <section className="card card-flush block">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Comerciante</th>
                <th>Fornecedor</th>
                <th className="right">Valor</th>
                <th>Estado</th>
                <th>Pedido</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ application, name, supplierName, market }) => (
                <tr key={application.id}>
                  <td>
                    <Link className="mono" href={`/gestao/credito/${application.id}`}>
                      {application.code}
                    </Link>
                  </td>
                  <td>
                    {name}
                    <div className="tiny muted">{market}</div>
                  </td>
                  <td>{supplierName}</td>
                  <td className="right num">{formatMT(application.requestedCents)}</td>
                  <td>
                    <Badge tone={APP_TONE[application.status]}>{APPLICATION_LABELS[application.status]}</Badge>
                  </td>
                  <td className="muted">{relativeTime(application.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
