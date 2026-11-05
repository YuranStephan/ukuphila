import { and, asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sha256 } from "@/server/crypto";
import type { Db } from "@/server/db/client";
import { journalEntries, notifications, xitiqueContributions, xitiqueEvents, xitiqueGroups, xitiqueMembers, xitiqueRounds } from "@/server/db/schema";
import { balanceOf, recordSale } from "@/server/ledger/operations";
import { applyBatch } from "@/server/sync/engine";
import { confirmContribution, confirmPayout, createGroup, drawOrder, groupDetail, joinByCode, markLateContributions, startGroup } from "@/server/xitique/service";
import { signedPhone } from "./fixtures";
import { ctx, inTx, makeMarket, makeMerchant, testDb } from "./helpers";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => { ({ db, close } = await testDb()); });
afterAll(() => close());

async function groupFixture(mode: "combinada" | "sorteio" = "combinada") {
  const market = await makeMarket(db);
  const people = [];
  for (const name of ["Treasurer", "Member B", "Member C"]) {
    const person = await makeMerchant(db, { name, marketId: market.id });
    await inTx(db, (tx) => recordSale(tx, ctx(person.id), { amountCents: 10_000 }));
    people.push(person);
  }
  const group = await createGroup(db, people[0], { name: "CX3 Xitique", contributionCents: 1_000, frequency: "semanal", payoutMode: mode, marketId: market.id });
  await joinByCode(db, people[1], ` ${group.code.toLowerCase()} `);
  await joinByCode(db, people[2], group.code);
  const members = await db.select().from(xitiqueMembers).where(eq(xitiqueMembers.groupId, group.id));
  const order = people.map((person) => members.find((member) => member.userId === person.id)!.id);
  return { group, people, members, order };
}

async function declare(userId: string, contributionId: string) {
  const phone = await signedPhone(db, userId);
  const op = await phone.sign("xitique.declare", { contributionId, pocket: "negocio" });
  const result = await applyBatch(db, userId, phone.deviceId, [op]);
  expect(result.results[0].status).toBe("applied");
  return { phone, op, result };
}

describe("Xitique domain", () => {
  it("creates a group, joins by code idempotently and fixes the agreed order", async () => {
    const { group, people, order } = await groupFixture();
    await joinByCode(db, people[1], group.code);
    expect((await groupDetail(db, group.id, people[0].id)).members).toHaveLength(3);
    const agreed = [...order].reverse();
    await startGroup(db, people[0], group.id, { startsOn: "2090-01-01", order: agreed });
    const detail = await groupDetail(db, group.id, people[0].id);
    expect(detail.group.status).toBe("activo");
    expect(detail.rounds.map((round) => round.recipientMemberId)).toEqual(agreed);
    expect(detail.rounds.map((round) => round.dueDate)).toEqual(["2090-01-01", "2090-01-08", "2090-01-15"]);
    expect(detail.members.map((member) => member.position)).toEqual([1, 2, 3]);
    expect(detail.rounds.every((round) => round.contributions.length === 3)).toBe(true);
    await expect(joinByCode(db, await makeMerchant(db), group.code)).rejects.toMatchObject({ code: "xitique_fechado" });
    await expect(startGroup(db, people[0], group.id, { startsOn: "2090-01-01" })).rejects.toMatchObject({ code: "xitique_estado" });
  });

  it("rejects an unknown code, a non-treasurer start and an invalid agreed order", async () => {
    const { group, people, order } = await groupFixture();
    await expect(joinByCode(db, people[1], "UNKNOWN")).rejects.toMatchObject({ code: "xitique_codigo" });
    await expect(startGroup(db, people[1], group.id, { startsOn: "2090-01-01" })).rejects.toMatchObject({ code: "xitique_acesso" });
    await expect(startGroup(db, people[0], group.id, { startsOn: "2090-01-01", order: [order[0], order[0], order[2]] })).rejects.toMatchObject({ code: "xitique_ordem" });
    expect((await groupDetail(db, group.id, people[0].id)).rounds).toEqual([]);
  });

  it("publishes a seed commitment before joining and reveals a reproducible draw", async () => {
    const { group, people, order } = await groupFixture("sorteio");
    expect(group.drawCommit).toBe(sha256(group.drawSeed!));
    const forming = await groupDetail(db, group.id, people[0].id);
    expect(forming.group.drawSeed).toBeNull();
    expect(forming.group.drawCommit).toBe(group.drawCommit);
    await startGroup(db, people[0], group.id, { startsOn: "2090-01-01", order: [...order].reverse() });
    const detail = await groupDetail(db, group.id, people[0].id);
    expect(sha256(detail.group.drawSeed!)).toBe(group.drawCommit);
    expect(detail.rounds.map((round) => round.recipientMemberId)).toEqual(drawOrder(detail.group.drawSeed!, order));
    expect(drawOrder(detail.group.drawSeed!, [...order].reverse())).toEqual(drawOrder(detail.group.drawSeed!, order));
    const event = detail.events.find((row) => row.kind === "grupo_iniciado");
    expect(event?.data).toMatchObject({ seed: detail.group.drawSeed, order: drawOrder(detail.group.drawSeed!, order) });
  });

  describe("contribution lock regressions (CX3-01)", () => {
    let fixture: Awaited<ReturnType<typeof groupFixture>>;
    let declareId: string;
    let confirmId: string;
    beforeAll(async () => {
      fixture = await groupFixture();
      const { group, people, order } = fixture;
      await startGroup(db, people[0], group.id, { startsOn: "2090-01-01", order: [order[1], order[0], order[2]] });
      const [round] = await db.select().from(xitiqueRounds).where(and(eq(xitiqueRounds.groupId, group.id), eq(xitiqueRounds.number, 1)));
      const contributions = await db.select().from(xitiqueContributions).where(eq(xitiqueContributions.roundId, round.id));
      declareId = contributions.find((row) => row.memberId === order[2])!.id;
      confirmId = contributions.find((row) => row.memberId === order[1])!.id;
      // Stored declaration isolates confirmation from the independently broken declaration query.
      await db.update(xitiqueContributions).set({ status: "declarada", declaredBy: people[1].id, declaredAt: new Date() }).where(eq(xitiqueContributions.id, confirmId));
    });

    // Reproduced SQLSTATE 42601: FOR UPDATE OF receives a schema-qualified table.
    it("declares through signed sync once and preserves the ledger on replay", async () => {
      const owner = fixture.people[2];
      const before = await balanceOf(db, owner.id, "negocio");
      const { phone, op } = await declare(owner.id, declareId);
      const replay = await applyBatch(db, owner.id, phone.deviceId, [op]);
      expect(replay.results[0].status).toBe("duplicate");
      expect(await balanceOf(db, owner.id, "negocio")).toBe(before - 1_000);
      expect(await balanceOf(db, owner.id, "xitique")).toBe(1_000);
      const entries = await db.select().from(journalEntries).where(and(eq(journalEntries.userId, owner.id), eq(journalEntries.kind, "xitique_contribuicao")));
      expect(entries).toHaveLength(1);
    });

    // The same SQL defect currently precedes all confirmation permission checks.
    it("rejects self-confirmation with the domain reason", async () => {
      await expect(confirmContribution(db, fixture.people[1], confirmId)).rejects.toMatchObject({ code: "xitique_duas_pessoas" });
    });

    it("rejects an unauthorised member with the domain reason", async () => {
      const { people } = fixture;
      await expect(confirmContribution(db, people[2], confirmId)).rejects.toMatchObject({ code: "xitique_acesso" });
    });

    it("accepts an independently declared contribution confirmed by a different treasurer", async () => {
      await confirmContribution(db, fixture.people[0], confirmId);
      expect((await db.select().from(xitiqueContributions).where(eq(xitiqueContributions.id, confirmId)))[0]).toMatchObject({ status: "confirmada", declaredBy: fixture.people[1].id, confirmedBy: fixture.people[0].id });
    });
  });

  it("the database rejects the same declarer and confirmer even without the service", async () => {
    const { group, people, order } = await groupFixture();
    await startGroup(db, people[0], group.id, { startsOn: "2090-01-01", order });
    const [round] = await db.select().from(xitiqueRounds).where(eq(xitiqueRounds.groupId, group.id));
    const [contribution] = await db.select().from(xitiqueContributions).where(eq(xitiqueContributions.roundId, round.id));
    await expect(db.update(xitiqueContributions).set({ status: "confirmada", declaredBy: people[0].id, confirmedBy: people[0].id }).where(eq(xitiqueContributions.id, contribution.id))).rejects.toThrow();
    expect((await db.select().from(xitiqueContributions).where(eq(xitiqueContributions.id, contribution.id)))[0].status).toBe("pendente");
  });

  it("posts each receipt once and concludes only after the final round", async () => {
    const { group, people, order } = await groupFixture();
    await startGroup(db, people[0], group.id, { startsOn: "2090-01-01", order });
    const rounds = await db.select().from(xitiqueRounds).where(eq(xitiqueRounds.groupId, group.id)).orderBy(asc(xitiqueRounds.number));
    for (const [index, round] of rounds.entries()) {
      const contributions = await db.select().from(xitiqueContributions).where(eq(xitiqueContributions.roundId, round.id));
      for (const contribution of contributions) {
        const declarer = people[order.indexOf(contribution.memberId)];
        const confirmer = declarer.id === people[0].id ? people[1] : people[0];
        // Isolate receipt/round transitions from CX3-01; this is stored fixture evidence, not a service workaround.
        await db.update(xitiqueContributions).set({ status: "confirmada", declaredBy: declarer.id, declaredAt: new Date(), confirmedBy: confirmer.id, confirmedAt: new Date() }).where(eq(xitiqueContributions.id, contribution.id));
      }
      const recipient = people[order.indexOf(round.recipientMemberId)];
      const before = await balanceOf(db, recipient.id, "negocio");
      await confirmPayout(db, recipient, round.id);
      await confirmPayout(db, recipient, round.id);
      expect(await balanceOf(db, recipient.id, "negocio")).toBe(before + 3_000);
      const [stored] = await db.select().from(xitiqueGroups).where(eq(xitiqueGroups.id, group.id));
      expect(stored.status).toBe(index === rounds.length - 1 ? "concluido" : "activo");
    }
    const receipts = await db.select().from(journalEntries).where(and(eq(journalEntries.refId, group.id), eq(journalEntries.kind, "xitique_recebimento")));
    expect(receipts).toHaveLength(3);
    expect(receipts.map((entry) => entry.amountCents)).toEqual([3_000, 3_000, 3_000]);
    expect(await db.select().from(xitiqueEvents).where(and(eq(xitiqueEvents.groupId, group.id), eq(xitiqueEvents.kind, "grupo_concluido")))).toHaveLength(1);
  });

  it("marks only pending past-due contributions and does not repeat notifications", async () => {
    const { group, people, order } = await groupFixture();
    await startGroup(db, people[0], group.id, { startsOn: "2090-01-01", order });
    const [round] = await db.select().from(xitiqueRounds).where(eq(xitiqueRounds.groupId, group.id)).orderBy(asc(xitiqueRounds.number));
    const [contribution] = await db.select().from(xitiqueContributions).where(eq(xitiqueContributions.roundId, round.id));
    const owner = people[order.indexOf(contribution.memberId)];
    // This job consumes stored state; its behaviour must remain testable while declaration is blocked.
    await db.update(xitiqueContributions).set({ status: "declarada", declaredBy: owner.id, declaredAt: new Date() }).where(eq(xitiqueContributions.id, contribution.id));
    expect(await markLateContributions(db, "2090-01-02")).toBeGreaterThanOrEqual(2);
    const rows = await db.select({ contribution: xitiqueContributions, round: xitiqueRounds }).from(xitiqueContributions).innerJoin(xitiqueRounds, eq(xitiqueRounds.id, xitiqueContributions.roundId)).where(eq(xitiqueRounds.groupId, group.id));
    expect(rows.filter((row) => row.contribution.status === "atrasada")).toHaveLength(2);
    expect(rows.filter((row) => row.round.number > 1).every((row) => row.contribution.status === "pendente")).toBe(true);
    expect(rows.find((row) => row.contribution.id === contribution.id)?.contribution.status).toBe("declarada");
    const notices = () => db.select().from(notifications).where(and(inArray(notifications.userId, people.map((person) => person.id)), eq(notifications.title, "Contribuição do Xitique em atraso")));
    const before = await notices();
    expect(before).toHaveLength(2);
    expect(await markLateContributions(db, "2090-01-02")).toBe(0);
    expect(await notices()).toHaveLength(before.length);
  });

  it("allows a second person to confirm the sole treasurer's contribution in their own receiving round", async () => {
    const { group, people, order } = await groupFixture();
    await startGroup(db, people[0], group.id, { startsOn: "2090-01-01", order });
    const [round] = await db.select().from(xitiqueRounds).where(eq(xitiqueRounds.groupId, group.id)).orderBy(asc(xitiqueRounds.number));
    const [contribution] = await db.select().from(xitiqueContributions).where(and(eq(xitiqueContributions.roundId, round.id), eq(xitiqueContributions.memberId, order[0])));
    await declare(people[0].id, contribution.id);
    await expect(confirmContribution(db, people[0], contribution.id)).rejects.toMatchObject({ code: "xitique_duas_pessoas" });
    await confirmContribution(db, people[1], contribution.id);
    const [stored] = await db.select().from(xitiqueContributions).where(eq(xitiqueContributions.id, contribution.id));
    expect(stored).toMatchObject({ status: "confirmada", declaredBy: people[0].id, confirmedBy: people[1].id });
  });
});
