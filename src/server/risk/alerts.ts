import "server-only";
import type { Executor } from "../db/client";
import { riskAlerts, type AlertSeverity } from "../db/schema";

export type AlertInput = {
  rule: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  subjectUserId?: string | null;
  marketId?: string | null;
  evidence?: Record<string, unknown>;
  dedupeKey: string;
};

/** Rules can fire every day: the dedupe key keeps one open alert per real situation. */
export async function raiseAlert(db: Executor, alert: AlertInput) {
  await db
    .insert(riskAlerts)
    .values({
      rule: alert.rule,
      severity: alert.severity,
      title: alert.title,
      detail: alert.detail,
      subjectUserId: alert.subjectUserId ?? null,
      marketId: alert.marketId ?? null,
      evidence: alert.evidence ?? null,
      dedupeKey: alert.dedupeKey,
    })
    .onConflictDoNothing({ target: riskAlerts.dedupeKey });
}
