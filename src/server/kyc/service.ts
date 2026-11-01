import "server-only";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { DOCUMENT_TYPES, REJECTION_REASONS } from "@/lib/labels";
import { recordAudit } from "../audit";
import { can } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import { decryptBytes, encryptBytes, sha256 } from "../crypto";
import type { Db, Executor, Tx } from "../db/client";
import { accessLog, documentBlobs, documentEvents, documents, kycAttestations, kycEvents, kycProfiles } from "../db/schema";
import { DomainError } from "../errors";
import { notify } from "../notifications";
import { raiseAlert } from "../risk/alerts";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/** Magic numbers, so a renamed file cannot pass as an image. */
function sniffMime(bytes: Buffer) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (bytes.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

function maskNumber(value: string | null | undefined) {
  if (!value) return null;
  const clean = value.replace(/\s/g, "");
  return clean.length <= 4 ? "••••" : `••••${clean.slice(-4)}`;
}

type Actor = { id: string; role: string };

export async function submitDocument(db: Db, actor: Actor, input: { userId: string; type: string; number?: string | null; bytes: Buffer; expiryDate?: string | null }) {
  if (!DOCUMENT_TYPES[input.type]) throw new DomainError("documento_tipo", "Tipo de documento desconhecido.");
  if (input.bytes.length === 0 || input.bytes.length > MAX_BYTES) throw new DomainError("documento_tamanho", "O ficheiro tem de ter até 3 MB.");
  const mime = sniffMime(input.bytes);
  if (!mime || !ALLOWED_MIME.has(mime)) throw new DomainError("documento_formato", "Usa uma fotografia (JPG, PNG, WEBP) ou um PDF.");
  const digest = sha256(input.bytes);
  const encrypted = encryptBytes(input.bytes);
  return db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [previous] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.userId, input.userId), eq(documents.type, input.type)))
      .orderBy(desc(documents.version))
      .limit(1);
    if (previous && ["submetido", "em_revisao", "aprovado"].includes(previous.status)) {
      throw new DomainError("documento_existente", "Este documento já foi submetido.");
    }
    const [document] = await tx
      .insert(documents)
      .values({
        userId: input.userId,
        type: input.type,
        numberMasked: maskNumber(input.number),
        status: "submetido",
        version: (previous?.version ?? 0) + 1,
        supersedesId: previous?.id ?? null,
        storageKey: `db:${digest.slice(0, 16)}`,
        mime,
        sizeBytes: input.bytes.length,
        sha256: digest,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        keyId: encrypted.keyId,
        submittedBy: actor.id,
        submittedAt: new Date(),
        expiryDate: input.expiryDate ?? null,
      })
      .returning();
    await tx.insert(documentBlobs).values({ documentId: document.id, ciphertext: encrypted.ciphertext });
    await tx.insert(documentEvents).values({ documentId: document.id, kind: "submetido", actorId: actor.id });
    await tx.update(kycProfiles).set({ status: "em_curso", updatedAt: new Date(), updatedBy: actor.id }).where(eq(kycProfiles.userId, input.userId));
    const [reused] = await tx
      .select({ userId: documents.userId })
      .from(documents)
      .where(and(eq(documents.sha256, digest), ne(documents.userId, input.userId)))
      .limit(1);
    if (reused) {
      await raiseAlert(tx, {
        rule: "documento_repetido",
        severity: "alta",
        title: "O mesmo ficheiro em duas contas",
        detail: "Um documento idêntico foi submetido para outra pessoa. Pode ser erro do agente ou tentativa de fraude.",
        subjectUserId: input.userId,
        dedupeKey: `documento_repetido:${digest.slice(0, 24)}`,
        evidence: { documentId: document.id, otherUserId: reused.userId, submittedBy: actor.id },
      });
    }
    await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "documento.submetido", subjectType: "document", subjectId: document.id, targetUserId: input.userId, data: { type: input.type, version: document.version } });
    return document;
  });
}

/** The person who submitted a document can never be the person who approves it (KB §29). */
export async function reviewDocument(db: Db, reviewer: SessionUser, documentId: string, input: { outcome: "aprovar" | "rejeitar"; reason?: string | null; note?: string | null }) {
  if (!can(reviewer.role, "kyc.review")) throw new DomainError("sem_permissao", "Não tens permissão para rever documentos.");
  if (input.outcome === "rejeitar" && (!input.reason || !REJECTION_REASONS[input.reason])) throw new DomainError("motivo", "Escolhe o motivo da rejeição.");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [document] = await tx.select().from(documents).where(eq(documents.id, documentId)).for("update");
    if (!document) throw new DomainError("documento", "Documento não encontrado.");
    if (!["submetido", "em_revisao"].includes(document.status)) throw new DomainError("documento_estado", "Este documento já foi revisto.");
    if (document.submittedBy === reviewer.id) throw new DomainError("segregacao", "Quem submete um documento não o pode rever.");
    const status = input.outcome === "aprovar" ? "aprovado" : "rejeitado";
    await tx
      .update(documents)
      .set({ status, reviewerId: reviewer.id, reviewedAt: new Date(), rejectionReason: input.outcome === "rejeitar" ? input.reason : null, rejectionNote: input.note ?? null })
      .where(eq(documents.id, documentId));
    await tx.insert(documentEvents).values({ documentId, kind: status, actorId: reviewer.id, note: input.note ?? (input.reason ? REJECTION_REASONS[input.reason] : null) });
    await recordAudit(tx, { actorId: reviewer.id, actorRole: reviewer.role, action: `documento.${status}`, subjectType: "document", subjectId: documentId, targetUserId: document.userId, data: { reason: input.reason ?? null } });
    await notify(tx, document.userId, status === "aprovado"
      ? { title: "Documento aprovado", body: `O teu ${DOCUMENT_TYPES[document.type]} foi aprovado.`, link: "/app/documentos" }
      : { title: "Precisamos de outra fotografia", body: `${REJECTION_REASONS[input.reason as string]}. O teu agente pode ajudar.`, link: "/app/documentos" });
    await recomputeLevel(tx, document.userId, reviewer);
  });
}

/** Level follows evidence. It only ever moves through this function, so every change has an actor and a reason (KB §28). */
export async function recomputeLevel(tx: Tx, userId: string, actor: Actor) {
  const [profile] = await tx.select().from(kycProfiles).where(eq(kycProfiles.userId, userId)).for("update");
  if (!profile) return;
  const approved = await tx
    .select({ type: documents.type })
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.status, "aprovado")));
  const [attestation] = await tx
    .select({ id: kycAttestations.id })
    .from(kycAttestations)
    .where(and(eq(kycAttestations.userId, userId), eq(kycAttestations.kind, "rosto_confirmado")))
    .limit(1);
  const types = new Set(approved.map((row) => row.type));
  let level = 0;
  let reason = "Sem evidência suficiente.";
  if (profile.faceCaptured && attestation) {
    level = 1;
    reason = "Telemóvel confirmado e rosto confirmado pelo agente.";
  }
  if (level === 1 && types.size >= 1) {
    level = 2;
    reason = "Documento aprovado pela revisão.";
  }
  if (level === 2 && types.size >= 2) {
    level = 3;
    reason = "Segundo documento aprovado pela revisão.";
  }
  if (level === profile.level) return;
  await tx
    .update(kycProfiles)
    .set({ level, status: level >= 1 ? "verificado" : "em_curso", updatedAt: new Date(), updatedBy: actor.id })
    .where(eq(kycProfiles.userId, userId));
  await tx.insert(kycEvents).values({ userId, fromLevel: profile.level, toLevel: level, reason, actorId: actor.id });
  await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "kyc.nivel_alterado", subjectType: "kyc", subjectId: userId, targetUserId: userId, data: { from: profile.level, to: level, reason } });
}

/** Agent evidence. `observado` is what the agent saw; `declarado` is what the person said. They are never merged. */
export async function attest(db: Db, actor: Actor & { agentId: string }, input: { userId: string; kind: "rosto_confirmado" | "banca_visitada" | "conhece_pessoa" | "morada_referida" | "actividade_confirmada"; source: "observado" | "declarado"; note?: string | null }) {
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    await tx.insert(kycAttestations).values({ userId: input.userId, agentId: actor.agentId, kind: input.kind, source: input.source, note: input.note ?? null });
    if (input.kind === "rosto_confirmado") {
      await tx.update(kycProfiles).set({ faceCaptured: true, status: "em_curso", updatedAt: new Date(), updatedBy: actor.id }).where(eq(kycProfiles.userId, input.userId));
    }
    await recordAudit(tx, { actorId: actor.id, actorRole: actor.role, action: "kyc.atestacao", subjectType: "kyc", subjectId: input.userId, targetUserId: input.userId, data: { kind: input.kind, source: input.source } });
    await recomputeLevel(tx, input.userId, actor);
  });
}

/** Viewing a document leaves a line the merchant can read in "Quem viu os meus dados". */
export async function openDocument(db: Db, viewer: SessionUser, documentId: string) {
  const [document] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!document) throw new DomainError("documento", "Documento não encontrado.");
  const own = document.userId === viewer.id;
  if (!own && !can(viewer.role, "document.view")) throw new DomainError("sem_permissao", "Não tens permissão para ver este documento.");
  if (!own) {
    await db.insert(accessLog).values({ subjectId: document.userId, actorId: viewer.id, actorRole: viewer.role, purpose: "Revisão de documento", resource: DOCUMENT_TYPES[document.type] });
  }
  const [blob] = await db.select().from(documentBlobs).where(eq(documentBlobs.documentId, documentId)).limit(1);
  if (!blob || !document.iv || !document.authTag) return { document, bytes: null };
  return { document, bytes: decryptBytes(Buffer.from(blob.ciphertext), document.iv, document.authTag) };
}

export async function logAccess(db: Executor, viewer: { id: string; role: string }, subjectId: string, purpose: string, resource: string) {
  await db.insert(accessLog).values({ subjectId, actorId: viewer.id, actorRole: viewer.role, purpose, resource });
}

export async function documentsFor(db: Executor, userId: string) {
  return db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt));
}

export async function reviewQueue(db: Executor) {
  return db.select().from(documents).where(inArray(documents.status, ["submetido", "em_revisao"])).orderBy(documents.submittedAt).limit(100);
}
