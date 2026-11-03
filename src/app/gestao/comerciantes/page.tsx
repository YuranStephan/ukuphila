import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, PageHead } from "@/components/ui";
import { relativeTime } from "@/lib/dates";
import { KYC_LEVEL_LABELS } from "@/lib/labels";
import { maskPhone } from "@/lib/phone";
import { listMerchants } from "@/server/admin/queries";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { markets } from "@/server/db/schema";
import { READINESS_LABELS, type Readiness } from "@/server/trust/engine";

export const metadata: Metadata = { title: "Comerciantes" };

const READY_TONE = { pronto_para_revisao: "good", quase: "info", a_crescer: "warn", a_comecar: "neutral" } as const;

export default async function MerchantsPage({ searchParams }: { searchParams: Promise<{ q?: string; mercado?: string; anel?: string }> }) {
  await requirePage("merchant.read");
  const { q, mercado, anel } = await searchParams;
  const db = await getDb();
  const [rows, marketRows] = await Promise.all([listMerchants(db, { q, market: mercado, ring: anel }), db.select({ slug: markets.slug, name: markets.name }).from(markets)]);
  return (
    <>
      <PageHead eyebrow="Pessoas" title="Comerciantes" lead="Abrir um perfil fica registado e aparece em “Quem viu os meus dados”, na aplicação do comerciante." />
      <form className="toolbar">
        <input className="input" name="q" defaultValue={q} placeholder="Nome ou negócio" aria-label="Pesquisar" />
        <select className="select" name="mercado" defaultValue={mercado ?? ""} aria-label="Mercado">
          <option value="">Todos os mercados</option>
          {marketRows.map((market) => (
            <option key={market.slug} value={market.slug}>
              {market.name}
            </option>
          ))}
        </select>
        <select className="select" name="anel" defaultValue={anel ?? ""} aria-label="Anel">
          <option value="">Todos os anéis</option>
          {[1, 2, 3, 4].map((ring) => (
            <option key={ring} value={ring}>
              Anel {ring}
            </option>
          ))}
        </select>
        <button className="btn btn-primary btn-s" type="submit">
          Filtrar
        </button>
      </form>
      <section className="card card-flush">
        {rows.length === 0 ? (
          <EmptyState title="Ninguém encontrado" icon="search" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Comerciante</th>
                  <th>Mercado</th>
                  <th>Agente</th>
                  <th>Verificação</th>
                  <th>Prontidão</th>
                  <th className="right">Registos 30 dias</th>
                  <th>Último registo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/gestao/comerciantes/${row.id}`}>{row.name}</Link>
                      <div className="tiny muted">
                        {row.businessName} · {maskPhone(row.phone)}
                      </div>
                    </td>
                    <td>{row.market}</td>
                    <td>{row.agent ?? "—"}</td>
                    <td>{KYC_LEVEL_LABELS[row.level]}</td>
                    <td>
                      {row.readiness ? (
                        <Badge tone={READY_TONE[row.readiness as Readiness]}>
                          Anel {row.ring} · {READINESS_LABELS[row.readiness as Readiness]}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="right num">{row.entries30}</td>
                    <td className="muted">{row.lastAt ? relativeTime(row.lastAt) : "Nunca"}</td>
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
