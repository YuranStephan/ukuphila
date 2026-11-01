"use client";

import { BottomNav } from "@/components/BottomNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { flushQueue } from "@/lib/client";
import { useEffect } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const go = () => {
      flushQueue().catch(() => {});
    };
    go();
    window.addEventListener("online", go);
    return () => window.removeEventListener("online", go);
  }, []);

  return (
    <div className="phone-frame app-shell">
      <OfflineBanner />
      <div className="app-main">{children}</div>
      <BottomNav />
    </div>
  );
}
