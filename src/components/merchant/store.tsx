"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyPending } from "@/lib/offline/overlay";
import { cachedSnapshot, cacheSnapshot, enqueue, ensureDevice, flush, pendingOps, type OpResult, type QueuedOp } from "@/lib/offline/engine";
import { wipeLocal } from "@/lib/offline/idb";
import type { MerchantSnapshot } from "@/server/merchant/snapshot";

export type Snapshot = MerchantSnapshot;

type Store = {
  snap: Snapshot | null;
  pending: QueuedOp[];
  online: boolean;
  syncing: boolean;
  lastSync: string | null;
  path: string;
  navigate: (path: string) => void;
  record: (type: string, payload: Record<string, unknown>, channel?: "app" | "voz") => Promise<void>;
  call: <T = { ok: boolean }>(action: string, body?: Record<string, unknown>) => Promise<T>;
  refresh: () => Promise<void>;
  toast: (message: string) => void;
  notice: string | null;
  rejected: OpResult[];
};

const StoreContext = createContext<Store | null>(null);

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore fora do AppProvider");
  return store;
}

function currentPath() {
  return typeof window === "undefined" ? "/app" : window.location.pathname.replace(/\/$/, "") || "/app";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<Snapshot | null>(null);
  const [pending, setPending] = useState<QueuedOp[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [path, setPath] = useState("/app");
  const [notice, setNotice] = useState<string | null>(null);
  const [rejected, setRejected] = useState<OpResult[]>([]);
  const userId = useRef<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  }, []);

  const signOutLocally = useCallback(async () => {
    await wipeLocal();
    window.location.href = "/entrar?next=/app";
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/app/snapshot", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) return signOutLocally();
      if (!response.ok) return;
      const snapshot = (await response.json()) as Snapshot;
      userId.current = snapshot.owner?.id ?? null;
      setRaw(snapshot);
      setLastSync(new Date().toISOString());
      await cacheSnapshot(snapshot);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [signOutLocally]);

  const sync = useCallback(async () => {
    if (!userId.current) return;
    setSyncing(true);
    try {
      const outcome = await flush(userId.current);
      if (outcome.signedOut) return signOutLocally();
      if (outcome.wiped) {
        window.location.href = "/entrar";
        return;
      }
      setOnline(!outcome.offline);
      const refused = outcome.results.filter((result) => result.status === "rejected");
      if (refused.length) setRejected((list) => [...refused, ...list].slice(0, 20));
      if (outcome.sent > 0) await refresh();
    } finally {
      setPending(await pendingOps());
      setSyncing(false);
    }
  }, [refresh, signOutLocally]);

  useEffect(() => {
    setPath(currentPath());
    const onPop = () => setPath(currentPath());
    window.addEventListener("popstate", onPop);
    (async () => {
      const cached = await cachedSnapshot<Snapshot>().catch(() => undefined);
      if (cached) {
        setRaw(cached);
        userId.current = cached.owner?.id ?? null;
      }
      setPending(await pendingOps().catch(() => []));
      await refresh();
      if (userId.current) {
        await ensureDevice(userId.current).catch(() => undefined);
        await sync();
      }
    })();
    const goOnline = () => {
      setOnline(true);
      void sync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const timer = setInterval(() => {
      if (navigator.onLine) void sync();
    }, 45_000);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(timer);
    };
  }, [refresh, sync]);

  const navigate = useCallback((next: string) => {
    if (next === currentPath()) return;
    window.history.pushState(null, "", next);
    setPath(next);
    window.scrollTo({ top: 0 });
  }, []);

  const record = useCallback(
    async (type: string, payload: Record<string, unknown>, channel: "app" | "voz" = "app") => {
      if (!userId.current) throw new Error("Ainda a abrir. Tenta outra vez.");
      await enqueue(userId.current, type, payload, channel);
      setPending(await pendingOps());
      if (navigator.onLine) void sync();
    },
    [sync],
  );

  const call = useCallback(async <T,>(action: string, body: Record<string, unknown> = {}) => {
    const response = await fetch("/api/app/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) }).catch(() => null);
    if (!response) throw new Error("Precisas de rede para isto.");
    if (response.status === 401) {
      await signOutLocally();
      throw new Error("Sessão terminada.");
    }
    const data = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir.");
    return data;
  }, [signOutLocally]);

  const snap = useMemo(() => (raw ? applyPending(raw, pending) : null), [raw, pending]);

  const value: Store = { snap, pending, online, syncing, lastSync, path, navigate, record, call, refresh, toast, notice, rejected };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
