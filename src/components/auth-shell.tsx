import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, WovenRings } from "./brand";

export function AuthShell({ quote, children }: { quote: string; children: ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-side" data-surface="noite">
        <WovenRings className="hero-rings" />
        <Link href="/" aria-label="Ukuphila, página inicial" style={{ position: "relative" }}>
          <Logo tone="light" />
        </Link>
        <p className="auth-quote">{quote}</p>
      </aside>
      <main className="auth-main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
