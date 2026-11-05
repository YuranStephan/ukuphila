import { ConsoleShell, type NavGroup } from "@/components/console/shell";
import { can, ROLE_LABELS } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";

export default async function RiskLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage("risk.read", "/risco");
  const groups: NavGroup[] = [
    { title: "Sala de risco", items: [
      { href: "/risco", label: "Visão geral", icon: "shield", exact: true },
      { href: "/risco/carteira", label: "Carteira e atrasos", icon: "coins" },
      { href: "/risco/alertas", label: "Alertas", icon: "alert" },
      { href: "/risco/casos", label: "Casos", icon: "document" },
    ] },
    { title: "Governação", items: [
      { href: "/risco/governacao", label: "Governação", icon: "users" },
      { href: "/risco/politicas", label: "Políticas", icon: "document" },
    ] },
  ];
  if (can(user.role, "merchant.read")) groups.push({ items: [{ href: "/gestao", label: "Voltar à gestão", icon: "arrowLeft", exact: true }] });
  return <ConsoleShell kicker="Sala de risco" groups={groups} user={{ name: user.displayName, role: ROLE_LABELS[user.role] }} night>{children}</ConsoleShell>;
}
