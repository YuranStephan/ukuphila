import type { Metadata } from "next";
import { Badge, DataNote, EmptyState, PageHead } from "@/components/ui";
import { formatMT } from "@/lib/money";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { supplierCatalogue, supplierProfile } from "@/server/supplier/queries";

export const metadata: Metadata = { title: "Catálogo do fornecedor" };

export default async function CataloguePage() {
  const user = await requirePage("supplier.portal", "/fornecedor/catalogo");
  const db = await getDb();
  const [supplier, products] = await Promise.all([supplierProfile(db, user), supplierCatalogue(db, user)]);
  return <>
    <PageHead eyebrow={supplier?.name ?? "Portal do fornecedor"} title="Catálogo" lead="Consulta os teus produtos, unidades de venda e preços registados." />
    <DataNote>As alterações ao catálogo são feitas pela gestão. O preço acordado em cada contrato mantém-se no respectivo histórico.</DataNote>
    <section className="card card-flush block">{!products.length ? <EmptyState icon="box" title={supplier ? "Ainda sem produtos" : "Conta por associar"}>{supplier ? "Pede à gestão para registar os produtos e preços do teu catálogo." : "A gestão precisa de associar a tua conta ao fornecedor."}</EmptyState> : <div className="table-wrap"><table className="table"><caption className="sr-only">Produtos e preços do teu fornecedor</caption><thead><tr><th scope="col">Produto</th><th scope="col">Unidade</th><th scope="col" className="right">Preço por unidade</th><th scope="col">Disponibilidade</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.unit}</td><td className="right num">{formatMT(product.priceCents)}</td><td><Badge tone={product.active ? "good" : "neutral"}>{product.active ? "Disponível" : "Inactivo"}</Badge></td></tr>)}</tbody></table></div>}</section>
  </>;
}
