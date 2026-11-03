import type { Metadata } from "next";
import { Badge, ExampleTag, PageHead } from "@/components/ui";
import { formatMT } from "@/lib/money";
import { agentPerformance } from "@/server/analytics/programme";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Agentes" };

export default async function AgentsPage() {
  await requirePage("ops.read");
  const rows = await agentPerformance(await getDb());
  return (
    <>
      <PageHead eyebrow="Pessoas" title="Agentes" lead="Quem está no terreno, a carteira de cada um e como está a correr." actions={<ExampleTag>Comissões de exemplo</ExampleTag>} />
      <section className="card card-flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Agente</th>
                <th>Mercado</th>
                <th>Estado</th>
                <th className="right">Carteira</th>
                <th className="right">Activos na semana</th>
                <th className="right">Visitas 30 dias</th>
                <th className="right">Incidentes</th>
                <th className="right">Ganhos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.name}
                    <div className="tiny muted mono">{row.code}</div>
                  </td>
                  <td>{row.market}</td>
                  <td>
                    <Badge tone={row.status === "activo" ? "good" : "warn"}>{row.status === "activo" ? "Activo" : row.status}</Badge>
                  </td>
                  <td className="right num">{row.merchants}</td>
                  <td className="right num">{row.active}</td>
                  <td className="right num">{row.visits}</td>
                  <td className="right num">{row.openIncidents}</td>
                  <td className="right num">{formatMT(row.earnedCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
