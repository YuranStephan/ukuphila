import type { Metadata } from "next";
import { Badge, PageHead, Stat } from "@/components/ui";
import { relativeTime } from "@/lib/dates";
import { formatMT } from "@/lib/money";
import { listDevices } from "@/server/admin/queries";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Telefones e leasing" };

export default async function DevicesPage() {
  await requirePage("ops.read");
  const rows = await listDevices(await getDb());
  const leased = rows.filter((row) => row.lease);
  return (
    <>
      <PageHead eyebrow="Operação" title="Telefones e leasing" lead="Cada telefone tem chave própria. Um telefone perdido é bloqueado e a cópia local é apagada quando voltar à rede." />
      <div className="stat-grid">
        <Stat icon="phone" label="Telefones activos" value={rows.filter((row) => row.device.status === "activo").length} />
        <Stat icon="coins" label="Em leasing" value={leased.length} />
        <Stat tone="sun" icon="alert" label="Com prestações em atraso" value={leased.filter((row) => row.late > 0).length} />
      </div>
      <section className="card card-flush block">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Comerciante</th>
                <th>Contrato</th>
                <th>Estado</th>
                <th className="right">Prestação</th>
                <th className="right">Pagas</th>
                <th className="right">Em atraso</th>
                <th>Última sincronização</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ device, lease, name, late, paid, total }) => (
                <tr key={device.id}>
                  <td>{name ?? "Em stock"}</td>
                  <td className="mono">{lease?.code ?? "—"}</td>
                  <td>
                    <Badge tone={device.status === "activo" ? "good" : "bad"}>{device.status === "activo" ? "Activo" : device.status}</Badge>
                  </td>
                  <td className="right num">{lease ? formatMT(lease.instalmentCents) : "—"}</td>
                  <td className="right num">{lease ? `${paid} de ${total}` : "—"}</td>
                  <td className="right num">{late || "—"}</td>
                  <td className="muted">{device.lastSyncAt ? relativeTime(device.lastSyncAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
