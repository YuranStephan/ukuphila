import { randomUUID, webcrypto } from "node:crypto";
import { eq } from "drizzle-orm";
import { canonicalJson, GENESIS_HASH, sha256Hex } from "@/lib/canonical";
import { setPin } from "@/server/auth/service";
import { acceptOffer, analyseApplication, approvePolicy, confirmDelivery, decideApplication, proposePolicy, submitApplication } from "@/server/credit/service";
import type { Db } from "@/server/db/client";
import { creditPolicies, kycProfiles, supplierProducts, suppliers, consents, type CreditPolicyParams } from "@/server/db/schema";
import { recordSale, recordSavingsDeposit } from "@/server/ledger/operations";
import { setSetting } from "@/server/settings";
import { registerDevice } from "@/server/sync/engine";
import type { IncomingOp } from "@/server/sync/schemas";
import type { TrustFacts, TrustPolicy } from "@/server/trust/engine";
import { asSession, ctx, inTx, makeMerchant, makeStaff } from "./helpers";

// Arbitrary test thresholds and prices, never commercial policy or market data.
export const trustPolicy: TrustPolicy = {
  version: "cx3-test", isExample: true,
  ring2: { activeDays14: 2 },
  ring3: { activeDays30: 3, minKycLevel: 1 },
  ring4: { minMonths: 1, activeDays90: 4, minKycLevel: 2, minSavingsMonths: 1, minXitiquePunctuality: 0.8 },
};

export function trustFacts(overrides: Partial<TrustFacts> = {}): TrustFacts {
  return {
    monthsActive: 0, activeDays14: 0, activeDays30: 0, activeDays90: 0,
    transfersToCasa60: 0, salesWeeksCv: null, kycLevel: 0,
    savingsMonths6: 0, savingsBalanceCents: 0, xitiqueDue: 0, xitiqueOnTime: 0,
    creditInstalmentsDue: 0, creditInstalmentsOnTime: 0, creditOverdue: 0, supplierContractsSettled: 0,
    ...overrides,
  };
}

export const readyFacts = () => trustFacts({
  monthsActive: 1, activeDays14: 2, activeDays30: 3, activeDays90: 4,
  kycLevel: 2, savingsMonths6: 1, savingsBalanceCents: 100,
});

export const creditParams: CreditPolicyParams = {
  isExample: true, maxAmountByRing: { base: 10_000, second: 20_000, third: 30_000 },
  termOptionsDays: [12, 24], feePercentBasisPoints: 125,
  graceDays: 2, defaultAfterDays: 40, concentrationLimitPct: 50,
};
export const TEST_PIN = "5937";

export async function grantConsent(db: Db, userId: string, purpose: string) {
  await db.insert(consents).values({ userId, purpose, policyVersion: "cx3-test", channel: "app", capturedBy: userId });
}

export async function creditFixture(db: Db, ready = true) {
  const merchant = await makeMerchant(db);
  const user = asSession(merchant);
  const analyst = await makeStaff(db, "credit_analyst");
  const approver = await makeStaff(db, "credit_approver");
  const supplierUser = await makeStaff(db, "supplier");
  const [supplier] = await db.insert(suppliers).values({ ownerId: supplierUser.id, name: "CX3 Supplier", category: "Alimentos", status: "activo" }).returning();
  const [product] = await db.insert(supplierProducts).values({ supplierId: supplier.id, name: "CX3 Rice", unit: "saco", priceCents: 2_001 }).returning();
  const version = `cx3-${randomUUID()}`;
  await proposePolicy(db, analyst, { version, params: creditParams });
  const [policy] = await db.select().from(creditPolicies).where(eq(creditPolicies.version, version));
  await approvePolicy(db, approver, policy.id);
  await setSetting(db, "trustPolicy", trustPolicy, analyst.id);
  if (ready) {
    // The KYC level is fixture evidence; the KYC suite exercises its complete workflow.
    await db.update(kycProfiles).set({ level: 2, faceCaptured: true, status: "verificado" }).where(eq(kycProfiles.userId, user.id));
    for (const daysAgo of [40, 2, 1, 0]) {
      await inTx(db, (tx) => recordSale(tx, ctx(user.id, { occurredAt: new Date(Date.now() - daysAgo * 86_400_000) }), { amountCents: 10_000 }));
    }
    await inTx(db, (tx) => recordSavingsDeposit(tx, ctx(user.id), { amountCents: 100 }));
  }
  const input = { supplierId: supplier.id, items: [{ supplierProductId: product.id, quantity: 3 }] };
  return { user, analyst, approver, supplierUser, supplier, product, policy, input };
}

export async function recommendedCredit(db: Db) {
  const fixture = await creditFixture(db);
  await grantConsent(db, fixture.user.id, "historial_credito");
  const application = await submitApplication(db, fixture.user, fixture.input);
  await analyseApplication(db, fixture.analyst, application.id, {
    outcome: "recomenda", reasonCodes: ["historico_consistente"], note: "Evidence checked for the domain test.", termDays: 12, instalments: 3,
  });
  return { ...fixture, application };
}

export async function acceptedCredit(db: Db) {
  const fixture = await recommendedCredit(db);
  await decideApplication(db, fixture.approver, fixture.application.id, { outcome: "aprova", reasonCodes: ["evidencia_revista"], note: "Independent review of the recorded evidence." });
  await setPin(db, fixture.user.id, TEST_PIN);
  const contract = await acceptOffer(db, fixture.user, fixture.application.id, TEST_PIN);
  return { ...fixture, contract };
}

export async function deliveredCredit(db: Db) {
  const fixture = await acceptedCredit(db);
  await confirmDelivery(db, fixture.supplierUser, fixture.contract.id, fixture.contract.deliveryCode);
  return fixture;
}

/** A real ECDSA phone, with the same canonical envelope as the sync protocol. */
export async function signedPhone(db: Db, userId: string) {
  const keys = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const publicKey = JSON.stringify(await webcrypto.subtle.exportKey("jwk", keys.publicKey));
  const deviceId = await registerDevice(db, userId, { publicKey, label: "CX3 phone" });
  let deviceSeq = 0;
  let prevHash = GENESIS_HASH;
  const sign = async (type: string, payload: Record<string, unknown>): Promise<IncomingOp> => {
    const base = { opId: randomUUID(), type, payload, channel: "app" as const, clientTime: new Date().toISOString(), deviceSeq: ++deviceSeq, prevHash };
    const hash = await sha256Hex(canonicalJson(base));
    const signature = await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, new TextEncoder().encode(hash));
    prevHash = hash;
    return { ...base, hash, signature: Buffer.from(signature).toString("base64url") };
  };
  return { deviceId, sign };
}

/** Byte signatures only: the service validates magic bytes, not image decoding. */
export function documentBytes(format: "jpeg" | "png" | "webp" | "pdf" = "png") {
  const headers = {
    jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    webp: Buffer.from("RIFF0000WEBP"),
    pdf: Buffer.from("%PDF-1.7\n"),
  };
  return Buffer.concat([headers[format], Buffer.from(randomUUID())]);
}
