import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activateWithCode, issueActivationCode, signInWithPin } from "@/server/auth/activation";
import type { Db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { makeAgent, makeMarket, makeMerchant, makeStaff, testDb } from "./helpers";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => { ({ db, close } = await testDb()); });
afterAll(() => close());

describe("activação e entrada com PIN", () => {
  it("o código activa a conta uma única vez e o PIN permite voltar a entrar", async () => {
    const merchant = await makeMerchant(db);
    const admin = await makeStaff(db, "admin");
    const code = await issueActivationCode(db, admin, merchant.id);
    await activateWithCode(db, merchant.phone!, code, "7492");
    expect((await signInWithPin(db, merchant.phone!, "7492")).id).toBe(merchant.id);
    await expect(activateWithCode(db, merchant.phone!, code, "6381")).rejects.toMatchObject({ code: "codigo" });
  });

  it("recusa um agente de outra carteira e um papel sem autorização no próprio domínio", async () => {
    const market = await makeMarket(db);
    const assigned = await makeAgent(db, market.id);
    const outsider = await makeAgent(db, market.id);
    const merchant = await makeMerchant(db, { marketId: market.id, agentId: assigned.agent.id });
    await expect(issueActivationCode(db, outsider.user, merchant.id)).rejects.toMatchObject({ code: "sem_permissao" });
    await expect(issueActivationCode(db, await makeStaff(db, "auditor"), merchant.id)).rejects.toMatchObject({ code: "sem_permissao" });
    expect(await issueActivationCode(db, assigned.user, merchant.id)).toMatch(/^\d{8}$/);
  });

  it("duas activaçōes concorrentes não reutilizam o código", async () => {
    const merchant = await makeMerchant(db);
    const code = await issueActivationCode(db, await makeStaff(db, "admin"), merchant.id);
    const results = await Promise.allSettled([
      activateWithCode(db, merchant.phone!, code, "7492"),
      activateWithCode(db, merchant.phone!, code, "6381"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });

  it("recusa contas suspensas na entrada e na activação", async () => {
    const merchant = await makeMerchant(db);
    const admin = await makeStaff(db, "admin");
    const code = await issueActivationCode(db, admin, merchant.id);
    await activateWithCode(db, merchant.phone!, code, "7492");
    const resetCode = await issueActivationCode(db, admin, merchant.id);
    await db.update(users).set({ status: "suspenso" }).where(eq(users.id, merchant.id));
    await expect(signInWithPin(db, merchant.phone!, "7492")).rejects.toMatchObject({ code: "conta_suspensa" });
    await expect(activateWithCode(db, merchant.phone!, resetCode, "6381")).rejects.toMatchObject({ code: "conta_suspensa" });
    await expect(issueActivationCode(db, admin, merchant.id)).rejects.toMatchObject({ code: "conta_suspensa" });
  });

  it("bloqueia o PIN depois de cinco erros e um novo código permite recuperar", async () => {
    const merchant = await makeMerchant(db);
    const admin = await makeStaff(db, "admin");
    await activateWithCode(db, merchant.phone!, await issueActivationCode(db, admin, merchant.id), "7492");
    for (let attempt = 0; attempt < 5; attempt++) await expect(signInWithPin(db, merchant.phone!, "6381")).rejects.toThrow();
    await expect(signInWithPin(db, merchant.phone!, "7492")).rejects.toMatchObject({ code: "pin_bloqueado" });
    await activateWithCode(db, merchant.phone!, await issueActivationCode(db, admin, merchant.id), "5284");
    expect((await signInWithPin(db, merchant.phone!, "5284")).id).toBe(merchant.id);
  });
});
