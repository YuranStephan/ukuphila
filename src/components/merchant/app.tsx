"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/brand";
import { Icon, type IconName } from "@/components/icon";
import { relativeTime } from "@/lib/dates";
import { RecordSheet, type RecordKind } from "./register";
import { BusinessScreen, EntriesScreen, HomeScreen, PocketsScreen } from "./screens";
import { AssistantScreen, CreditScreen, DocumentsScreen, HistoryScreen, MoreScreen, NoticesScreen, PrivacyScreen, ProfileScreen, ReviewScreen, XitiqueScreen } from "./screens-more";
import { AppProvider, useStore } from "./store";

const TABS: { to: string; label: string; icon: IconName; match: (path: string) => boolean }[] = [
  { to: "/app", label: "Hoje", icon: "home", match: (path) => path === "/app" },
  { to: "/app/movimentos", label: "Movimentos", icon: "activity", match: (path) => path.startsWith("/app/movimentos") },
  { to: "/app/negocio", label: "Negócio", icon: "box", match: (path) => path.startsWith("/app/negocio") },
  { to: "/app/mais", label: "Mais", icon: "settings", match: (path) => !["/app", "/app/movimentos", "/app/negocio"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) },
];

function Status() {
  const { online, pending, syncing, lastSync } = useStore();
  const label = !online ? `Sem rede${pending.length ? ` · ${pending.length} por enviar` : ""}` : syncing ? "A sincronizar…" : pending.length ? `${pending.length} por enviar` : lastSync ? `Actualizado ${relativeTime(lastSync)}` : "A ligar…";
  return (
    <span className="m-status" data-state={!online ? "offline" : pending.length ? "pending" : "ok"} role="status">
      <Icon name={!online ? "wifiOff" : "sync"} size={14} />
      {label}
    </span>
  );
}

function Router({ openRecord }: { openRecord: (kind: RecordKind) => void }) {
  const { path } = useStore();
  if (path === "/app" || path === "/app/registar") return <HomeScreen openRecord={openRecord} />;
  if (path.startsWith("/app/movimentos")) return <EntriesScreen />;
  if (path.startsWith("/app/negocio")) return <BusinessScreen />;
  if (path.startsWith("/app/bolsos")) return <PocketsScreen />;
  if (path.startsWith("/app/xitique/")) return <XitiqueScreen groupId={path.split("/")[3]} />;
  if (path.startsWith("/app/xitique")) return <XitiqueScreen />;
  if (path.startsWith("/app/credito")) return <CreditScreen />;
  if (path.startsWith("/app/historial")) return <HistoryScreen />;
  if (path.startsWith("/app/documentos")) return <DocumentsScreen />;
  if (path.startsWith("/app/assistente")) return <AssistantScreen />;
  if (path.startsWith("/app/privacidade")) return <PrivacyScreen />;
  if (path.startsWith("/app/avisos")) return <NoticesScreen />;
  if (path.startsWith("/app/rever")) return <ReviewScreen />;
  if (path.startsWith("/app/perfil")) return <ProfileScreen />;
  return <MoreScreen />;
}

function Shell() {
  const { path, navigate, notice } = useStore();
  const [sheet, setSheet] = useState<{ open: boolean; kind: RecordKind; text?: string }>({ open: false, kind: "venda" });

  // Share target and deep links: /app/registar?text=… opens the sheet with the shared SMS or phrase already read.
  useEffect(() => {
    if (path !== "/app/registar") return;
    const text = new URLSearchParams(window.location.search).get("text") ?? undefined;
    setSheet({ open: true, kind: "venda", text });
  }, [path]);

  const openRecord = (kind: RecordKind) => setSheet({ open: true, kind });
  return (
    <div className="m-app">
      <header className="m-top">
        <button type="button" onClick={() => navigate("/app")} aria-label="Hoje">
          <Logo tone="light" size={24} />
        </button>
        <Status />
      </header>
      <main className="m-main">
        <Router openRecord={openRecord} />
      </main>
      {notice ? (
        <div className="m-toast" role="status">
          {notice}
        </div>
      ) : null}
      <nav className="m-nav" aria-label="Navegação">
        {TABS.slice(0, 2).map((tab) => (
          <button key={tab.to} type="button" aria-current={tab.match(path) ? "page" : undefined} onClick={() => navigate(tab.to)}>
            <Icon name={tab.icon} size={22} />
            {tab.label}
          </button>
        ))}
        <button type="button" className="m-nav-main" onClick={() => openRecord("venda")} aria-label="Registar">
          <Icon name="plus" size={28} stroke={2.4} />
        </button>
        {TABS.slice(2).map((tab) => (
          <button key={tab.to} type="button" aria-current={tab.match(path) ? "page" : undefined} onClick={() => navigate(tab.to)}>
            <Icon name={tab.icon} size={22} />
            {tab.label}
          </button>
        ))}
      </nav>
      <RecordSheet
        open={sheet.open}
        initialKind={sheet.kind}
        initialText={sheet.text}
        onClose={() => {
          setSheet((current) => ({ ...current, open: false, text: undefined }));
          if (path === "/app/registar") navigate("/app");
        }}
      />
    </div>
  );
}

export function MerchantApp() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
