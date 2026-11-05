import { desc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { Badge, PageHead } from "@/components/ui";
import { formatMT } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { requirePage } from "@/server/auth/session";
import { getDb, rowsOf } from "@/server/db/client";
import { suppliers } from "@/server/db/schema";

export const metadata: Metadata = { title: "Fornecedores" };

export default async function SuppliersAdminPage() {
  await requirePage("credit.read");
  const db = await getDb();
  const [rows, stats] = await Promise.all([
    db.select().from(suppliers).orderBy(desc(suppliers.createdAt)),
    db.execute(sql`
      select s.id,
        (select count(*) from ukuphila.supplier_products p where p.supplier_id = s.id and p.active) as products,
        (select count(*) from ukuphila.credit_contracts c where c.supplier_id = s.id) as contracts,
        (select coalesce(sum(c.principal_cents), 0) from ukuphila.credit_contracts c where c.supplier_id = s.id) as volume,
        (select coalesce(sum(i.amount_cents - i.paid_cents), 0) from ukuphila.credit_instalments i join ukuphila.credit_contracts c on c.id = i.contract_id where c.supplier_id = s.id) as outstanding
      from ukuphila.suppliers s
    `),
  ]);
  const byId = new Map(rowsOf<{ id: string; products: string; contracts: string; volume: string; outstanding: string }>(stats).map((row) => [row.id, row]));
  return (
    <>
      <PageHead eyebrow="Pessoas" title="Fornecedores" lead="Parceiros do crédito fornecedor e o que cada um tem em curso." />
      <section className="card card-flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Categoria</th>
                <th>Estado</th>
                <th className="right">Produtos</th>
                <th className="right">Contratos</th>
                <th className="right">Volume</th>
                <th className="right">Em dívida</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((supplier) => {
                const stat = byId.get(supplier.id);
                return (
                  <tr key={supplier.id}>
                    <td>
                      {supplier.name}
                      <div className="tiny muted">{formatPhone(supplier.phone)}</div>
                    </td>
                    <td>{supplier.category}</td>
                    <td>
                      <Badge tone={supplier.status === "activo" ? "good" : "warn"}>{supplier.status === "activo" ? "Activo" : supplier.status}</Badge>
                    </td>
                    <td className="right num">{stat?.products}</td>
                    <td className="right num">{stat?.contracts}</td>
                    <td className="right num">{formatMT(Number(stat?.volume ?? 0))}</td>
                    <td className="right num">{formatMT(Number(stat?.outstanding ?? 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
