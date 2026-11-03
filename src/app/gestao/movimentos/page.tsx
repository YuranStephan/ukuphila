import type { Metadata } from "next";
import Link from "next/link";
import { Badge, DataNote, PageHead } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { ENTRY_LABELS } from "@/lib/labels";
import { formatMT } from "@/lib/money";
import { listEntries } from "@/server/admin/queries";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Movimentos" };

const CHANNELS = ["app", "voz", "whatsapp", "agente", "sistema"];

export default async function EntriesPage({ searchParams }: { searchParams: Promise<{ tipo?: string; canal?: string }> }) {
  await requirePage("ledger.read");
  const { tipo, canal } = await searchParams;
  const rows = await listEntries(await getDb(), { kind: tipo, channel: canal });
  return (
    <>
      <PageHead eyebrow="Operação" title="Movimentos" lead="Os últimos registos de todos os comerciantes. Nenhum pode ser alterado ou apagado, nem por esta equipa." />
      <form className="toolbar">
        <select className="select" name="tipo" defaultValue={tipo ?? ""} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {Object.entries(ENTRY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select className="select" name="canal" defaultValue={canal ?? ""} aria-label="Canal">
          <option value="">Todos os canais</option>
          {CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </select>
        <button className="btn btn-primary btn-s" type="submit">
          Filtrar
        </button>
      </form>
      <section className="card card-flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Comerciante</th>
                <th>Tipo</th>
                <th>Canal</th>
                <th className="right">Valor</th>
                <th>Cadeia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, name }) => (
                <tr key={entry.id}>
                  <td className="muted">{formatDateTime(entry.occurredAt)}</td>
                  <td>
                    <Link href={`/gestao/comerciantes/${entry.userId}`}>{name}</Link>
                  </td>
                  <td>
                    {ENTRY_LABELS[entry.kind]}
                    {entry.needsReview ? (
                      <>
                        {" "}
                        <Badge tone="warn">Por rever</Badge>
                      </>
                    ) : null}
                  </td>
                  <td>{entry.channel}</td>
                  <td className="right num">{formatMT(entry.amountCents)}</td>
                  <td className="hash">#{entry.seq} {entry.hash.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <DataNote>O Ukuphila regista o que os comerciantes declaram. Estes valores não representam dinheiro à guarda da plataforma.</DataNote>
    </>
  );
}
