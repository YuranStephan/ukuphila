import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export type Tone = "good" | "warn" | "bad" | "info" | "neutral";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="badge" data-tone={tone}>
      {children}
    </span>
  );
}

/** Marks a number that is a working assumption, never an approved term (KB §15.3). */
export function ExampleTag({ children = "Exemplo · por validar" }: { children?: ReactNode }) {
  return <span className="tag-example">{children}</span>;
}

export function PageHead({ eyebrow, title, lead, actions }: { eyebrow?: string; title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="grow">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {lead ? <p className="page-lead">{lead}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Stat({ label, value, hint, tone, icon, href }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "sun" | "night" | "bad"; icon?: IconName; href?: string }) {
  const body = (
    <>
      <span className="stat-label">
        {icon ? <Icon name={icon} size={15} /> : null}
        {label}
      </span>
      <span className="stat-value num">{value}</span>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </>
  );
  return href ? (
    <Link className="stat" data-tone={tone} href={href}>
      {body}
    </Link>
  ) : (
    <div className="stat" data-tone={tone}>
      {body}
    </div>
  );
}

export function EmptyState({ title, children, icon = "box" }: { title: string; children?: ReactNode; icon?: IconName }) {
  return (
    <div className="empty">
      <Icon name={icon} size={26} />
      <strong>{title}</strong>
      {children ? <p className="small">{children}</p> : null}
    </div>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="row-between section-title">
      <h2 className="card-title">{title}</h2>
      {action}
    </div>
  );
}

export function DataNote({ children }: { children: ReactNode }) {
  return (
    <p className="data-note">
      <Icon name="alert" size={14} />
      <span>{children}</span>
    </p>
  );
}
