import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { markLeadAction } from "@/actions/gestao";
import { Badge, EmptyState, PageHead } from "@/components/ui";
import { relativeTime } from "@/lib/dates";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { leads } from "@/server/db/schema";

export const metadata: Metadata = { title: "Contactos" };

export default async function LeadsPage() {
  await requirePage("ops.read");
  const rows = await (await getDb()).select().from(leads).orderBy(desc(leads.createdAt)).limit(100);
  return (
    <>
      <PageHead eyebrow="Pessoas" title="Contactos do site" lead="Quem pediu para falar connosco." />
      <section className="card card-flush">
        {rows.length === 0 ? (
          <EmptyState title="Sem contactos" icon="chat" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Tipo</th>
                  <th>Mensagem</th>
                  <th>Recebido</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      {lead.name}
                      <div className="tiny muted">{[lead.organisation, lead.phone, lead.email].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td>{lead.kind}</td>
                    <td className="small">{lead.message}</td>
                    <td className="muted">{relativeTime(lead.createdAt)}</td>
                    <td>
                      <Badge tone={lead.status === "novo" ? "warn" : "good"}>{lead.status}</Badge>
                    </td>
                    <td>
                      {lead.status === "novo" ? (
                        <form action={markLeadAction.bind(null, lead.id, "contactado")}>
                          <button className="btn btn-ghost btn-s" type="submit">
                            Contactado
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
