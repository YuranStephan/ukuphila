"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOutAction } from "@/actions/auth";
import { Logo } from "@/components/brand";
import { ChartTips } from "@/components/chart-tips";
import { Icon, type IconName } from "@/components/icon";

export type NavItem = { href: string; label: string; icon: IconName; count?: number; exact?: boolean };
export type NavGroup = { title?: string; items: NavItem[] };

function isCurrent(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ConsoleShell({ kicker, groups, user, night, demo, children }: { kicker: string; groups: NavGroup[]; user: { name: string; role: string }; night?: boolean; demo?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      {demo ? (
        <p className="demo-bar no-print">
          Dados sintéticos de demonstração. <Link href="/demo">Trocar de pessoa</Link>
        </p>
      ) : null}
      <div className="console">
        <aside className="rail no-print">
          <div className="rail-brand">
            <Link href="/" aria-label="Ukuphila">
              <Logo tone="light" size={26} />
            </Link>
            <span className="rail-kicker">{kicker}</span>
          </div>
          <nav className="rail-nav" aria-label={kicker}>
            {groups.map((group, index) => (
              <div key={group.title ?? index} style={{ display: "contents" }}>
                {group.title ? <span className="rail-group">{group.title}</span> : null}
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item) ? "page" : undefined}>
                    <Icon name={item.icon} size={18} />
                    {item.label}
                    {item.count ? <span className="count num">{item.count}</span> : null}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="rail-user">
            <div className="grow">
              <strong className="truncate">{user.name}</strong>
              <span className="tiny">{user.role}</span>
            </div>
            <form action={signOutAction}>
              <button type="submit" aria-label="Terminar sessão">
                <Icon name="logout" size={18} />
              </button>
            </form>
          </div>
        </aside>
        <main className="console-main" data-surface={night ? "noite" : undefined}>
          {children}
        </main>
      </div>
      <ChartTips />
    </>
  );
}

export function FieldShell({ items, title, demo, children }: { items: NavItem[]; title: string; demo?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="field-app">
      {demo ? (
        <p className="demo-bar no-print">
          Dados sintéticos. <Link href="/demo">Trocar de pessoa</Link>
        </p>
      ) : null}
      <header className="field-top">
        <Logo tone="light" size={24} />
        <span className="tiny">{title}</span>
        <form action={signOutAction}>
          <button type="submit" aria-label="Terminar sessão" style={{ color: "inherit", display: "grid", placeItems: "center", width: 36, height: 36 }}>
            <Icon name="logout" size={18} />
          </button>
        </form>
      </header>
      <main className="field-main">{children}</main>
      <nav className="bottom-bar no-print" aria-label="Navegação">
        {items.map((item) => (
          <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item) ? "page" : undefined}>
            <Icon name={item.icon} size={21} />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
