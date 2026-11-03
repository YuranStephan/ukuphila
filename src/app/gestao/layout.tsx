import { ConsoleShell, type NavGroup } from "@/components/console/shell";
import { consoleCounts } from "@/server/admin/queries";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { isDemo } from "@/server/env";

export default async function GestaoLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage(["admin", "auditor", "kyc_reviewer", "credit_analyst", "credit_approver", "risk_analyst"], "/gestao");
  const counts = await consoleCounts(await getDb());
  const groups: NavGroup[] = [
    { items: [{ href: "/gestao", label: "Visão geral", icon: "chart", exact: true }] },
    {
      title: "Pessoas",
      items: [
        { href: "/gestao/comerciantes", label: "Comerciantes", icon: "users" },
        { href: "/gestao/agentes", label: "Agentes", icon: "hand" },
        { href: "/gestao/fornecedores", label: "Fornecedores", icon: "truck" },
        { href: "/gestao/contactos", label: "Contactos", icon: "chat", count: counts.leads },
      ],
    },
    {
      title: "Decisões",
      items: [
        { href: "/gestao/kyc", label: "KYC e documentos", icon: "document", count: counts.kyc },
        { href: "/gestao/credito", label: "Crédito", icon: "coins", count: counts.credit },
      ],
    },
    {
      title: "Operação",
      items: [
        { href: "/gestao/movimentos", label: "Movimentos", icon: "activity" },
        { href: "/gestao/operacoes", label: "Incidentes e sync", icon: "sync", count: counts.incidents + counts.conflicts },
        { href: "/gestao/dispositivos", label: "Telefones e leasing", icon: "phone" },
        { href: "/gestao/ia", label: "IA e WhatsApp", icon: "whatsapp" },
        { href: "/gestao/conhecimento", label: "Conhecimento", icon: "book" },
      ],
    },
    {
      title: "Governação",
      items: [
        { href: "/gestao/piloto", label: "Piloto e prontidão", icon: "flag" },
        { href: "/gestao/auditoria", label: "Auditoria", icon: "shield" },
        { href: "/gestao/definicoes", label: "Definições", icon: "settings" },
        { href: "/gestao/equipa", label: "Equipa", icon: "user" },
        { href: "/risco", label: "Sala de risco", icon: "alert", count: counts.alerts },
      ],
    },
  ];
  return (
    <ConsoleShell kicker="Gestão" groups={groups} user={{ name: user.displayName, role: ROLE_LABELS[user.role] }} demo={isDemo()}>
      {children}
    </ConsoleShell>
  );
}
