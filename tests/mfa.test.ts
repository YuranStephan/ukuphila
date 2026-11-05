import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { completeMfa, prepareMfa } from "@/server/auth/mfa";
import { hashSecret, openText, sealText, totpCode } from "@/server/crypto";
import type { Db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { makeStaff, testDb } from "./helpers";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => { ({ db, close } = await testDb()); });
afterAll(() => close());
async function staff() {
  const actor = await makeStaff(db, "admin");
  const [user] = await db.update(users).set({ passwordHash: await hashSecret("temporary-test-password") }).where(eq(users.id, actor.id)).returning();
  return user;
}

describe("configuração de autenticação forte no primeiro acesso", () => {
  it("só activa depois de confirmar o código da aplicação e não aceita repetir a configuração", async () => {
    const user = await staff();
    const challenge = prepareMfa(user);
    expect((await db.select().from(users).where(eq(users.id, user.id)))[0].totpEnabledAt).toBeNull();
    await expect(completeMfa(db, user, challenge.token, "errado")).rejects.toMatchObject({ code: "mfa" });
    const updated = await completeMfa(db, user, challenge.token, totpCode(challenge.secret));
    expect(updated.totpEnabledAt).toBeInstanceOf(Date);
    expect(openText(updated.totpSecret!)).toBe(challenge.secret);
    await expect(completeMfa(db, user, challenge.token, totpCode(challenge.secret))).rejects.toMatchObject({ code: "mfa" });
  });

  it("liga a configuração à conta, à palavra-passe e ao prazo", async () => {
    const first = await staff();
    const second = await staff();
    const challenge = prepareMfa(first);
    const tampered = `${challenge.token[0] === "A" ? "B" : "A"}${challenge.token.slice(1)}`;
    await expect(completeMfa(db, first, tampered, totpCode(challenge.secret))).rejects.toMatchObject({ code: "mfa" });
    await expect(completeMfa(db, second, challenge.token, totpCode(challenge.secret))).rejects.toMatchObject({ code: "mfa" });
    const expired = sealText(JSON.stringify({ ...JSON.parse(openText(challenge.token)), expiresAt: Date.now() - 1 }));
    await expect(completeMfa(db, first, expired, totpCode(challenge.secret))).rejects.toMatchObject({ code: "mfa" });
    const [changed] = await db.update(users).set({ passwordHash: await hashSecret("another-test-password") }).where(eq(users.id, first.id)).returning();
    await expect(completeMfa(db, changed, challenge.token, totpCode(challenge.secret))).rejects.toMatchObject({ code: "mfa" });
  });
});
