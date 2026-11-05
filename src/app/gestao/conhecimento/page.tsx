import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import { setKbStatusAction } from "@/actions/gestao";
import { Badge, DataNote, PageHead } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { searchKnowledge } from "@/server/ai/knowledge";
import { can } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { kbChunks, kbDocuments } from "@/server/db/schema";

export const metadata: Metadata = { title: "Base de conhecimento" };

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePage("ops.read");
  const { q } = await searchParams;
  const db = await getDb();
  const [documents, chunks, results] = await Promise.all([
    db.select().from(kbDocuments).orderBy(kbDocuments.id),
    db.select({ documentId: kbChunks.documentId, total: sql<string>`count(*)` }).from(kbChunks).groupBy(kbChunks.documentId),
    q ? searchKnowledge(db, q, 3) : Promise.resolve([]),
  ]);
  const canApprove = can(user.role, "kb.approve");
  return (
    <>
      <PageHead eyebrow="Operação" title="Base de conhecimento" lead="A IA responde só com documentos aprovados e cita a fonte. Se o documento for despublicado, a IA deixa de o usar." />
      <form className="toolbar">
        <input className="input" name="q" defaultValue={q} placeholder="Testar: como funciona o crédito?" aria-label="Pergunta de teste" style={{ maxWidth: 420 }} />
        <button className="btn btn-primary btn-s" type="submit">
          Pesquisar
        </button>
      </form>
      {results.length ? (
        <section className="card" style={{ marginBottom: 14 }}>
          {results.map((result) => (
            <div key={`${result.documentId}-${result.section}`} style={{ padding: "6px 0" }}>
              <p className="small">
                <strong className="mono">{result.documentId}</strong> · {result.title} · {result.section}
              </p>
              <p className="small muted">{result.content.slice(0, 220)}…</p>
            </div>
          ))}
        </section>
      ) : null}
      <section className="card card-flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Documento</th>
                <th>Domínio</th>
                <th>Autoridade</th>
                <th className="right">Excertos</th>
                <th>Versão</th>
                <th>Estado</th>
                {canApprove ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td className="mono">{document.id}</td>
                  <td>{document.title}</td>
                  <td>{document.domain}</td>
                  <td>{document.authority}</td>
                  <td className="right num">{chunks.find((row) => row.documentId === document.id)?.total ?? 0}</td>
                  <td>
                    {document.version} · {document.effectiveDate ? formatDay(document.effectiveDate) : "—"}
                  </td>
                  <td>
                    <Badge tone={document.status === "approved" ? "good" : "warn"}>{document.status === "approved" ? "Aprovado" : "Rascunho"}</Badge>
                  </td>
                  {canApprove ? (
                    <td>
                      <form action={setKbStatusAction.bind(null, document.id, document.status === "approved" ? "draft" : "approved")}>
                        <button className="btn btn-ghost btn-s" type="submit">
                          {document.status === "approved" ? "Despublicar" : "Aprovar"}
                        </button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <DataNote>“Aprovado” quer dizer disponível para a IA. Cada documento deve ser revisto por quem tem autoridade sobre o seu domínio.</DataNote>
    </>
  );
}
