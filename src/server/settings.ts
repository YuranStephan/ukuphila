import "server-only";
import { eq } from "drizzle-orm";
import { DEFAULT_SUPPORT_WHATSAPP } from "@/lib/contact";
import type { Executor } from "./db/client";
import { settings } from "./db/schema";

/*
 * Every number here is a working assumption, not an approved commercial term (KB §15.3, §44).
 * They are starting values that management changes in Definições; every change is audited.
 */
export const defaults = {
  organisation: {
    name: "Ukuphila",
    tagline: "Crescer. Conectar. Prosperar.",
    supportWhatsapp: DEFAULT_SUPPORT_WHATSAPP,
    supportPhone: "",
    supportEmail: "",
    legalEntity: "",
  },
  offlinePolicy: {
    isExample: false,
    maxOpCents: 2_500_000,
    maxPendingCents: 10_000_000,
    maxAgeDays: 14,
    allowed: [
      "sale.record",
      "expense.record",
      "stock.purchase",
      "pocket.transfer",
      "capital.in",
      "product.upsert",
      "stock.adjust",
      "customer.upsert",
      "fiado.repay",
      "savings.deposit",
      "savings.withdraw",
      "savings.goal",
      "entry.reverse",
      "xitique.declare",
    ],
  },
  trustPolicy: {
    version: "2026.11",
    isExample: false,
    ring2: { activeDays14: 5 },
    ring3: { activeDays30: 12, minKycLevel: 1 },
    ring4: { minMonths: 3, activeDays90: 45, minKycLevel: 2, minSavingsMonths: 2, minXitiquePunctuality: 0.85 },
  },
  agentRates: {
    isExample: false,
    onboardingCents: 15_000,
    kycCompleteCents: 10_000,
    activation30dCents: 20_000,
  },
  marketPulse: { minMerchants: 5 },
  aiPolicy: { confidenceFloor: 0.62, proposalTtlMinutes: 30, escalateAfterFailures: 2 },
};

type Defaults = typeof defaults;
export type SettingKey = keyof Defaults;
export type SettingValue<K extends SettingKey> = Defaults[K];

export async function getSetting<K extends SettingKey>(db: Executor, key: K): Promise<SettingValue<K>> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  return { ...defaults[key], ...((row?.value as object) ?? {}) } as SettingValue<K>;
}

export async function setSetting<K extends SettingKey>(db: Executor, key: K, value: SettingValue<K>, updatedBy: string | null) {
  await db
    .insert(settings)
    .values({ key, value, updatedBy })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy, updatedAt: new Date() } });
}
