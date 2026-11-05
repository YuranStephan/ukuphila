import type { ReactNode } from "react";
import { FieldShell, type NavItem } from "@/components/console/shell";
import { agentProfile } from "@/server/agent/service";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

const items: NavItem[] = [
  { href: "/agente", label: "Ronda", icon: "map", exact: true },
  { href: "/agente/comerciantes", label: "Comerciantes", icon: "users" },
  { href: "/agente/novo", label: "Novo", icon: "plus" },
  { href: "/agente/incidentes", label: "Incidentes", icon: "flag" },
];

export default async function AgentLayout({ children }: { children: ReactNode }) {
  const user = await requirePage(["agent"], "/agente");
  const agent = await agentProfile(await getDb(), user.id);
  return <div style={{ overflowWrap: "anywhere" }}><FieldShell title={`${user.displayName} · ${agent.marketName}`} items={items}>{children}</FieldShell></div>;
}
