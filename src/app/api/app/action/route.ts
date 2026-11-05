import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/server/audit";
import { setPin, checkPin } from "@/server/auth/service";
import { acceptOffer, declineOffer, submitApplication } from "@/server/credit/service";
import { getDb, type Tx } from "@/server/db/client";
import { accessLog, consents, kycEvents, notifications, syncConflicts, users } from "@/server/db/schema";
import { DomainError } from "@/server/errors";
import { openIncident } from "@/server/agent/service";
import { listNotifications, markAllRead } from "@/server/notifications";
import { issuePassport, revokePassport } from "@/server/passport";
import { addOfflineMember, confirmContribution, confirmPayout, createGroup, groupDetail, joinByCode, startGroup } from "@/server/xitique/service";
import { CONSENT_PURPOSES } from "@/lib/labels";
import { jsonError, merchantOr401 } from "../_auth";

/*
 * Merchant actions that need the network: they involve other people (Xitique, credit), signatures (PIN) or privacy.
 * Day-to-day records do not come here; they go through the offline queue.
 */

const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("xitique.create"), name: z.string().trim().min(2).max(60), contributionCents: z.number().int().positive(), frequency: z.enum(["semanal", "quinzenal", "mensal"]), payoutMode: z.enum(["combinada", "sorteio"]), rules: z.string().max(400).optional() }),
  z.object({ action: z.literal("xitique.join"), code: z.string().trim().min(4).max(20) }),
  z.object({ action: z.literal("xitique.member"), groupId: z.uuid(), name: z.string().trim().min(2).max(60), phone: z.string().max(20).optional() }),
  z.object({ action: z.literal("xitique.start"), groupId: z.uuid(), startsOn: z.string().date(), order: z.array(z.uuid()).min(2).max(100).optional() }),
  z.object({ action: z.literal("xitique.confirm"), contributionId: z.uuid() }),
  z.object({ action: z.literal("xitique.payout"), roundId: z.uuid(), receiptNote: z.string().trim().min(10).max(4000).optional() }),
  z.object({ action: z.literal("xitique.detail"), groupId: z.uuid() }),
  z.object({ action: z.literal("credit.apply"), supplierId: z.uuid(), items: z.array(z.object({ supplierProductId: z.uuid(), quantity: z.number().int().positive().max(10_000) })).min(1).max(20) }),
  z.object({ action: z.literal("credit.accept"), applicationId: z.uuid(), pin: z.string().min(4).max(6) }),
  z.object({ action: z.literal("credit.decline"), applicationId: z.uuid() }),
  z.object({ action: z.literal("passport.issue"), audience: z.string().trim().min(2).max(80), scope: z.array(z.string()).min(1), days: z.number().int().min(1).max(90) }),
  z.object({ action: z.literal("passport.revoke"), passportId: z.uuid() }),
  z.object({ action: z.literal("consent.set"), purpose: z.string(), granted: z.boolean() }),
  z.object({ action: z.literal("pin.set"), pin: z.string().min(4).max(6), currentPin: z.string().max(6).optional() }),
  z.object({ action: z.literal("privacy.view") }),
  z.object({ action: z.literal("notifications.read") }),
  z.object({ action: z.literal("support.open"), title: z.string().trim().min(3).max(120), description: z.string().trim().max(800).optional() }),
  z.object({ action: z.literal("conflict.resolve"), conflictId: z.uuid() }),
]);

export async function POST(request: Request) {
  const user = await merchantOr401(request);
  if (user instanceof NextResponse) return user;
  const parsed = actions.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const input = parsed.data;
  const db = await getDb();
  const actor = { id: user.id, displayName: user.displayName };
  try {
    switch (input.action) {
      case "xitique.create": {
        const group = await createGroup(db, actor, input);
        return NextResponse.json({ ok: true, groupId: group.id, code: group.code });
      }
      case "xitique.join": {
        const group = await joinByCode(db, actor, input.code);
        return NextResponse.json({ ok: true, groupId: group.id });
      }
      case "xitique.member":
        await addOfflineMember(db, actor, input.groupId, { displayName: input.name, phone: input.phone ?? null });
        return NextResponse.json({ ok: true });
      case "xitique.start":
        await startGroup(db, actor, input.groupId, { startsOn: input.startsOn, order: input.order });
        return NextResponse.json({ ok: true });
      case "xitique.confirm":
        await confirmContribution(db, actor, input.contributionId);
        return NextResponse.json({ ok: true });
      case "xitique.payout":
        await confirmPayout(db, actor, input.roundId, { receiptNote: input.receiptNote });
        return NextResponse.json({ ok: true });
      case "xitique.detail":
        return NextResponse.json(await groupDetail(db, input.groupId, user.id));
      case "credit.apply": {
        const application = await submitApplication(db, user, { supplierId: input.supplierId, items: input.items });
        return NextResponse.json({ ok: true, code: application.code });
      }
      case "credit.accept": {
        const contract = await acceptOffer(db, user, input.applicationId, input.pin);
        return NextResponse.json({ ok: true, code: contract.code, deliveryCode: contract.deliveryCode });
      }
      case "credit.decline":
        await declineOffer(db, user, input.applicationId);
        return NextResponse.json({ ok: true });
      case "passport.issue": {
        const passport = await issuePassport(db, user, input);
        return NextResponse.json({ ok: true, code: passport.code });
      }
      case "passport.revoke":
        await revokePassport(db, user, input.passportId);
        return NextResponse.json({ ok: true });
      case "consent.set": {
        const purpose = CONSENT_PURPOSES[input.purpose];
        if (!purpose) throw new DomainError("consentimento", "Finalidade desconhecida.");
        if (purpose.required && !input.granted) throw new DomainError("consentimento", "Este consentimento é necessário para usar o serviço. Para sair, fala com o teu agente.");
        await db.transaction(async (rawTx) => {
          const tx = rawTx as Tx;
          await tx.update(consents).set({ status: "revogado", revokedAt: new Date() }).where(and(eq(consents.userId, user.id), eq(consents.purpose, input.purpose), eq(consents.status, "concedido")));
          if (input.granted) await tx.insert(consents).values({ userId: user.id, purpose: input.purpose, policyVersion: "2026.11", channel: "app", capturedBy: user.id });
          await recordAudit(tx, { actorId: user.id, actorRole: user.role, action: input.granted ? "consentimento.concedido" : "consentimento.revogado", subjectType: "consent", subjectId: input.purpose, targetUserId: user.id });
        });
        return NextResponse.json({ ok: true });
      }
      case "pin.set": {
        const [row] = await db.select({ pinHash: users.pinHash }).from(users).where(eq(users.id, user.id)).limit(1);
        if (row?.pinHash) await checkPin(db, user.id, input.currentPin ?? "");
        await setPin(db, user.id, input.pin);
        return NextResponse.json({ ok: true });
      }
      case "privacy.view": {
        const [viewers, events, inbox] = await Promise.all([
          db.select({ log: accessLog, name: users.displayName }).from(accessLog).innerJoin(users, eq(users.id, accessLog.actorId)).where(eq(accessLog.subjectId, user.id)).orderBy(desc(accessLog.at)).limit(50),
          db.select().from(kycEvents).where(eq(kycEvents.userId, user.id)).orderBy(desc(kycEvents.createdAt)).limit(10),
          listNotifications(db, user.id, 40),
        ]);
        return NextResponse.json({
          viewers: viewers.map(({ log, name }) => ({ id: log.id, name, role: log.actorRole, purpose: log.purpose, resource: log.resource, at: log.at })),
          kycEvents: events,
          notifications: inbox,
        });
      }
      case "notifications.read":
        await markAllRead(db, user.id);
        return NextResponse.json({ ok: true });
      case "support.open": {
        const code = await openIncident(db, user, { kind: "suporte", title: input.title, description: input.description ?? input.title, subjectUserId: user.id, via: "app" });
        return NextResponse.json({ ok: true, code });
      }
      case "conflict.resolve":
        await db
          .update(syncConflicts)
          .set({ status: "resolvido", resolvedBy: user.id, resolvedAt: new Date(), resolution: "Confirmado pelo comerciante." })
          .where(and(eq(syncConflicts.id, input.conflictId), eq(syncConflicts.userId, user.id)));
        await db.insert(notifications).values({ userId: user.id, title: "Registo confirmado", body: "Ficou confirmado que o registo estava certo." });
        return NextResponse.json({ ok: true });
    }
  } catch (error) {
    return jsonError(error);
  }
}
