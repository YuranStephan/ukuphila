import type { ReactNode } from "react";
import { ConsoleShell, type NavGroup } from "@/components/console/shell";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { supplierProfile } from "@/server/supplier/queries";

export default async function SupplierLayout({ children }: { children: ReactNode }) {
  const user = await requirePage("supplier.portal", "/fornecedor");
  const supplier = await supplierProfile(await getDb(), user);
  const groups: NavGroup[] = [{ title: supplier?.name ?? "Fornecedor", items: [
    { href: "/fornecedor", label: "Encomendas", icon: "truck", exact: true },
    { href: "/fornecedor/catalogo", label: "Catálogo", icon: "box" },
    { href: "/fornecedor/liquidacoes", label: "Liquidações", icon: "coins" },
  ] }];
  return <ConsoleShell kicker="Portal do fornecedor" groups={groups} user={{ name: user.displayName, role: "Fornecedor" }}>{children}</ConsoleShell>;
}
