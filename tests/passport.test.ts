import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PASSPORT_SECTIONS } from "@/lib/labels";
import type { Db } from "@/server/db/client";
import { passports } from "@/server/db/schema";
import { recordSale, recordSavingsDeposit } from "@/server/ledger/operations";
import { issuePassport, revokePassport, verifyPassport } from "@/server/passport";
import { asSession, ctx, inTx, makeMerchant, testDb } from "./helpers";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => { ({ db, close } = await testDb()); });
afterAll(() => close());

async function fixture(scope = ["identidade", "volume"]) {
  const user = asSession(await makeMerchant(db));
  await inTx(db, (tx) => recordSale(tx, ctx(user.id), { amountCents: 123_456 }));
  await inTx(db, (tx) => recordSavingsDeposit(tx, ctx(user.id), { amountCents: 1_234 }));
  const passport = await issuePassport(db, user, { audience: "CX3 recipient", scope, days: 7 });
  return { user, passport };
}

describe("signed business passports", () => {
  it.each(Object.keys(PASSPORT_SECTIONS))("shares only the chosen %s section", async (section) => {
    const { passport } = await fixture([section, "unknown"]);
    const view = await verifyPassport(db, ` ${passport.code.toLowerCase()} `);
    expect(view?.state).toBe("valido");
    expect(view?.scope).toEqual([section]);
    expect(Object.keys(view!.snapshot!).sort()).toEqual(["generatedAt", "policyVersion", section].sort());
    if (section === "volume") expect(view?.snapshot?.volume).toEqual({ band: "Até 10 mil MT por mês" });
    if (section === "poupanca") expect(view?.snapshot?.poupanca).toEqual({ months6: 1 });
    expect((await db.select().from(passports).where(eq(passports.id, passport.id)))[0].views).toBe(1);
  });

  it("shows no data after revocation and ignores revocation by another account", async () => {
    const { user, passport } = await fixture();
    const outsider = asSession(await makeMerchant(db));
    await revokePassport(db, outsider, passport.id);
    expect((await verifyPassport(db, passport.code))?.state).toBe("valido");
    await revokePassport(db, user, passport.id);
    await revokePassport(db, user, passport.id);
    expect(await verifyPassport(db, passport.code)).toEqual({ state: "revogado" });
    expect((await db.select().from(passports).where(eq(passports.id, passport.id)))[0].views).toBe(1);
  });

  it("shows no snapshot or metadata after expiry", async () => {
    const { passport } = await fixture();
    await db.update(passports).set({ expiresAt: new Date(Date.now() - 1_000) }).where(eq(passports.id, passport.id));
    expect(await verifyPassport(db, passport.code)).toEqual({ state: "expirado" });
    expect((await db.select().from(passports).where(eq(passports.id, passport.id)))[0].views).toBe(0);
  });

  it.each(["signature", "snapshot"] as const)("detects a modified %s and reveals no data", async (field) => {
    const { passport } = await fixture();
    await db.update(passports).set(field === "signature" ? { signature: "0".repeat(64) } : { snapshot: { identidade: { name: "Tampered" } } }).where(eq(passports.id, passport.id));
    expect(await verifyPassport(db, passport.code)).toEqual({ state: "adulterado" });
    expect((await db.select().from(passports).where(eq(passports.id, passport.id)))[0].views).toBe(0);
  });

  it("requires valid sections and a recipient and returns null for an unknown code", async () => {
    const user = asSession(await makeMerchant(db));
    await expect(issuePassport(db, user, { audience: "CX3", scope: ["unknown"], days: 7 })).rejects.toMatchObject({ code: "passaporte" });
    await expect(issuePassport(db, user, { audience: "  ", scope: ["identidade"], days: 7 })).rejects.toMatchObject({ code: "passaporte" });
    expect(await verifyPassport(db, "UNKNOWN")).toBeNull();
  });
});
