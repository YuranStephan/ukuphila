import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { accessLog, documentBlobs, documentEvents, documents, kycEvents, kycProfiles, riskAlerts } from "@/server/db/schema";
import { attest, openDocument, recomputeLevel, reviewDocument, submitDocument } from "@/server/kyc/service";
import { documentBytes } from "./fixtures";
import { asSession, inTx, makeAgent, makeMarket, makeMerchant, makeStaff, testDb } from "./helpers";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => { ({ db, close } = await testDb()); });
afterAll(() => close());

describe("progressive KYC", () => {
  it.each([
    ["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"], ["pdf", "application/pdf"],
  ] as const)("identifies %s from its bytes and stores encrypted content", async (format, mime) => {
    const user = await makeMerchant(db);
    const bytes = documentBytes(format);
    const document = await submitDocument(db, user, { userId: user.id, type: "bi", number: "12345678", bytes });
    expect(document).toMatchObject({ mime, sizeBytes: bytes.length, numberMasked: "••••5678", status: "submetido" });
    expect(document.sha256).toMatch(/^[a-f0-9]{64}$/);
    const [blob] = await db.select().from(documentBlobs).where(eq(documentBlobs.documentId, document.id));
    expect(Buffer.from(blob.ciphertext).equals(bytes)).toBe(false);
    expect((await openDocument(db, asSession(user), document.id)).bytes).toEqual(bytes);
  });

  it("rejects unsupported document types, renamed text and missing or oversized bytes", async () => {
    const user = await makeMerchant(db);
    const input = { userId: user.id, type: "bi", bytes: documentBytes() };
    await expect(submitDocument(db, user, { ...input, type: "unknown" })).rejects.toMatchObject({ code: "documento_tipo" });
    await expect(submitDocument(db, user, { ...input, bytes: Buffer.from("identity.jpg is only a filename") })).rejects.toMatchObject({ code: "documento_formato" });
    await expect(submitDocument(db, user, { ...input, bytes: Buffer.alloc(0) })).rejects.toMatchObject({ code: "documento_tamanho" });
    await expect(submitDocument(db, user, { ...input, bytes: Buffer.alloc(3 * 1024 * 1024 + 1) })).rejects.toMatchObject({ code: "documento_tamanho" });
    expect(await db.select().from(documents).where(eq(documents.userId, user.id))).toHaveLength(0);
  });

  it("refuses review by the submitter even when that person has the reviewer role", async () => {
    const user = await makeMerchant(db);
    const reviewer = await makeStaff(db, "kyc_reviewer");
    const document = await submitDocument(db, reviewer, { userId: user.id, type: "bi", bytes: documentBytes() });
    await expect(reviewDocument(db, reviewer, document.id, { outcome: "aprovar" })).rejects.toMatchObject({ code: "segregacao" });
    expect((await db.select().from(documents).where(eq(documents.id, document.id)))[0].status).toBe("submetido");
    expect(await db.select().from(documentEvents).where(eq(documentEvents.documentId, document.id))).toHaveLength(1);
  });

  it("requires a recognised rejection reason, records it and permits a new version", async () => {
    const user = await makeMerchant(db);
    const reviewer = await makeStaff(db, "kyc_reviewer");
    const document = await submitDocument(db, user, { userId: user.id, type: "bi", bytes: documentBytes() });
    for (const reason of [undefined, "", "unknown"]) {
      await expect(reviewDocument(db, reviewer, document.id, { outcome: "rejeitar", reason })).rejects.toMatchObject({ code: "motivo" });
    }
    expect((await db.select().from(documents).where(eq(documents.id, document.id)))[0].status).toBe("submetido");
    await reviewDocument(db, reviewer, document.id, { outcome: "rejeitar", reason: "ilegivel", note: "Image cannot be read." });
    expect((await db.select().from(documents).where(eq(documents.id, document.id)))[0]).toMatchObject({ status: "rejeitado", rejectionReason: "ilegivel", reviewerId: reviewer.id });
    const replacement = await submitDocument(db, user, { userId: user.id, type: "bi", bytes: documentBytes() });
    expect(replacement).toMatchObject({ version: 2, supersedesId: document.id });
    await expect(submitDocument(db, user, { userId: user.id, type: "bi", bytes: documentBytes() })).rejects.toMatchObject({ code: "documento_existente" });
  });

  it("moves 0 to 1 to 2 to 3 only as agent evidence and independent approvals accumulate", async () => {
    const market = await makeMarket(db);
    const { user: agent, agent: profile } = await makeAgent(db, market.id);
    const merchant = await makeMerchant(db, { marketId: market.id, agentId: profile.id });
    const reviewer = await makeStaff(db, "kyc_reviewer");
    const level = async () => (await db.select().from(kycProfiles).where(eq(kycProfiles.userId, merchant.id)))[0].level;
    expect(await level()).toBe(0);
    await attest(db, { ...agent, agentId: profile.id }, { userId: merchant.id, kind: "banca_visitada", source: "observado" });
    expect(await level()).toBe(0);
    await attest(db, { ...agent, agentId: profile.id }, { userId: merchant.id, kind: "rosto_confirmado", source: "observado" });
    expect(await level()).toBe(1);
    const first = await submitDocument(db, agent, { userId: merchant.id, type: "bi", bytes: documentBytes() });
    expect(await level()).toBe(1);
    await reviewDocument(db, reviewer, first.id, { outcome: "aprovar" });
    expect(await level()).toBe(2);
    const second = await submitDocument(db, agent, { userId: merchant.id, type: "nuit", bytes: documentBytes("pdf") });
    expect(await level()).toBe(2);
    await reviewDocument(db, reviewer, second.id, { outcome: "aprovar" });
    expect(await level()).toBe(3);
    await inTx(db, (tx) => recomputeLevel(tx, merchant.id, reviewer));
    const changes = await db.select().from(kycEvents).where(eq(kycEvents.userId, merchant.id));
    expect(changes.map((event) => [event.fromLevel, event.toLevel]).sort((a, b) => a[0] - b[0])).toEqual([[0, 1], [1, 2], [2, 3]]);
    expect(changes.every((event) => event.actorId && event.reason && event.createdAt instanceof Date)).toBe(true);
  });

  it("does not replace initial face evidence with an approved document", async () => {
    const user = await makeMerchant(db);
    const reviewer = await makeStaff(db, "kyc_reviewer");
    const document = await submitDocument(db, user, { userId: user.id, type: "bi", bytes: documentBytes() });
    await reviewDocument(db, reviewer, document.id, { outcome: "aprovar" });
    expect((await db.select().from(kycProfiles).where(eq(kycProfiles.userId, user.id)))[0].level).toBe(0);
  });

  it("raises a high-severity alert when identical bytes appear on another account", async () => {
    const first = await makeMerchant(db);
    const second = await makeMerchant(db);
    const bytes = documentBytes();
    await submitDocument(db, first, { userId: first.id, type: "bi", bytes });
    const repeated = await submitDocument(db, second, { userId: second.id, type: "bi", bytes });
    const alerts = await db.select().from(riskAlerts).where(eq(riskAlerts.subjectUserId, second.id));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ rule: "documento_repetido", severity: "alta", evidence: { documentId: repeated.id, otherUserId: first.id, submittedBy: second.id } });
  });

  it("logs staff document access, decrypts the bytes and denies another merchant", async () => {
    const user = await makeMerchant(db);
    const outsider = await makeMerchant(db);
    const reviewer = await makeStaff(db, "kyc_reviewer");
    const bytes = documentBytes("pdf");
    const document = await submitDocument(db, user, { userId: user.id, type: "bi", bytes });
    await expect(openDocument(db, asSession(outsider), document.id)).rejects.toMatchObject({ code: "sem_permissao" });
    expect(await db.select().from(accessLog).where(eq(accessLog.subjectId, user.id))).toHaveLength(0);
    expect((await openDocument(db, reviewer, document.id)).bytes).toEqual(bytes);
    const logs = await db.select().from(accessLog).where(eq(accessLog.subjectId, user.id));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actorId: reviewer.id, actorRole: "kyc_reviewer", purpose: "Revisão de documento", resource: "Bilhete de Identidade" });
    await expect(db.delete(accessLog).where(eq(accessLog.id, logs[0].id))).rejects.toThrow();
  });
});
