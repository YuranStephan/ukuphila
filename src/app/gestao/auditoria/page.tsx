import type { Metadata } from "next";
import { verifyAuditAction } from "@/actions/gestao";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHead } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { listAudit } from "@/server/admin/queries";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Auditoria" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ acao?: string }> }) {
  await requirePage("audit.read");
  const { acao } = await searchParams;
  const rows = await listAudit(await getDb(), { action: acao });
  return (
    <>
      <PageHead
        eyebrow="Governação"
        title="Auditoria"
        lead="Cada evento liga-se ao anterior por uma impressão digital. Ninguém, nem a gestão, consegue alterar ou apagar um evento: a base de dados recusa."
        actions={
          <ActionForm action={verifyAuditAction} className="row">
            <SubmitButton className="btn btn-primary btn-s">Verificar a cadeia</SubmitButton>
          </ActionForm>
        }
      />
      <form className="toolbar">
        <input className="input" name="acao" defaultValue={acao} placeholder="Filtrar acção, por exemplo credito" aria-label="Filtrar acção" />
        <button className="btn btn-ghost btn-s" type="submit">
          Filtrar
        </button>
      </form>
      <section className="card card-flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Quando</th>
                <th>Acção</th>
                <th>Quem</th>
                <th>Função</th>
                <th>Sobre</th>
                <th>Elo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ event, actor }) => (
                <tr key={event.seq}>
                  <td className="num">{event.seq}</td>
                  <td className="muted">{formatDateTime(event.at)}</td>
                  <td className="mono">{event.action}</td>
                  <td>{actor ?? "Sistema"}</td>
                  <td>{event.actorRole}</td>
                  <td className="muted">{event.subjectType}</td>
                  <td className="hash">{event.hash.slice(0, 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
