import "server-only";
import { mayConfirmContribution } from "@/lib/xitique";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { addDays, maputoDay } from "@/lib/dates";
import { formatMT } from "@/lib/money";
import { randomCode, randomToken, sha256 } from "../crypto";
import type { Db, Executor, Tx } from "../db/client";
import { users, xitiqueContributions, xitiqueEvents, xitiqueGroups, xitiqueMembers, xitiqueRounds } from "../db/schema";
import { DomainError } from "../errors";
import type { OperationContext } from "../ledger/operations";
import { postEntry } from "../ledger/post";
import { notify } from "../notifications";

/*
 * Ukuphila does not invent the Xitique: it keeps the group's memory. Changes are visible to members in the group
 * history, and money is only "confirmada" when a second person says so (the database enforces the two people).
 */

type Actor = { id: string; displayName: string };

async function logEvent(tx: Executor, groupId: string, kind: string, actorId: string | null, summary: string, data?: Record<string, unknown>) {
  await tx.insert(xitiqueEvents).values({ groupId, kind, actorId, summary, data: data ?? null });
}

async function membership(db: Executor, groupId: string, userId: string) {
  const [member] = await db
    .select()
    .from(xitiqueMembers)
    .where(and(eq(xitiqueMembers.groupId, groupId), eq(xitiqueMembers.userId, userId), eq(xitiqueMembers.status, "activo")))
    .limit(1);
  return member ?? null;
}

async function requireMember(db: Executor, groupId: string, userId: string) {
  const member = await membership(db, groupId, userId);
  if (!member) throw new DomainError("xitique_acesso", "Não fazes parte deste grupo.");
  return member;
}

export async function createGroup(
  db: Db,
  actor: Actor,
  input: { name: string; contributionCents: number; frequency: "semanal" | "quinzenal" | "mensal"; payoutMode: "combinada" | "sorteio"; rules?: string | null; marketId?: string | null },
) {
  return db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const seed = randomToken(16);
    const [group] = await tx
      .insert(xitiqueGroups)
      .values({
        name: input.name,
        code: `UKU-${randomCode(5)}`,
        createdBy: actor.id,
        marketId: input.marketId ?? null,
        contributionCents: input.contributionCents,
        frequency: input.frequency,
        payoutMode: input.payoutMode,
        rules: input.rules ?? null,
        // Published before anyone joins, so the eventual draw can be checked against it.
        drawCommit: input.payoutMode === "sorteio" ? sha256(seed) : null,
        drawSeed: input.payoutMode === "sorteio" ? seed : null,
      })
      .returning();
    await tx.insert(xitiqueMembers).values({ groupId: group.id, userId: actor.id, displayName: actor.displayName, role: "tesoureiro" });
    await logEvent(tx, group.id, "grupo_criado", actor.id, `${actor.displayName} criou o grupo com contribuição de ${formatMT(input.contributionCents)}.`);
    return group;
  });
}

export async function joinByCode(db: Db, actor: Actor, code: string) {
  const [group] = await db.select().from(xitiqueGroups).where(eq(xitiqueGroups.code, code.trim().toUpperCase())).limit(1);
  if (!group) throw new DomainError("xitique_codigo", "Não encontrámos um grupo com esse código.");
  if (group.status !== "formacao") throw new DomainError("xitique_fechado", "Este grupo já começou. Fala com quem gere o grupo.");
  if (await membership(db, group.id, actor.id)) return group;
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    await tx.insert(xitiqueMembers).values({ groupId: group.id, userId: actor.id, displayName: actor.displayName });
    await logEvent(tx, group.id, "membro_entrou", actor.id, `${actor.displayName} entrou no grupo.`);
  });
  return group;
}

/** Local practice includes people without the app: the treasurer can list them, and declares on their behalf. */
export async function addOfflineMember(db: Db, actor: Actor, groupId: string, input: { displayName: string; phone?: string | null }) {
  const member = await requireMember(db, groupId, actor.id);
  if (member.role !== "tesoureiro") throw new DomainError("xitique_acesso", "Só quem gere o grupo pode acrescentar membros.");
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    await tx.insert(xitiqueMembers).values({ groupId, displayName: input.displayName, phone: input.phone ?? null });
    await logEvent(tx, groupId, "membro_adicionado", actor.id, `${actor.displayName} acrescentou ${input.displayName}.`);
  });
}

/** Order for a sorteio: a pure function of the revealed seed, so any member can recompute it. */
export function drawOrder(seed: string, memberIds: string[]) {
  return [...memberIds].sort((a, b) => sha256(`${seed}:${a}`).localeCompare(sha256(`${seed}:${b}`)));
}

const STEP = { semanal: 7, quinzenal: 14, mensal: 30 } as const;

export async function startGroup(db: Db, actor: Actor, groupId: string, input: { startsOn: string; order?: string[] }) {
  return db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const member = await requireMember(tx, groupId, actor.id);
    if (member.role !== "tesoureiro") throw new DomainError("xitique_acesso", "Só quem gere o grupo pode começar.");
    const [group] = await tx.select().from(xitiqueGroups).where(eq(xitiqueGroups.id, groupId)).for("update");
    if (group.status !== "formacao") throw new DomainError("xitique_estado", "Este grupo já começou.");
    const members = await tx.select().from(xitiqueMembers).where(and(eq(xitiqueMembers.groupId, groupId), eq(xitiqueMembers.status, "activo")));
    if (members.length < 3) throw new DomainError("xitique_membros", "Um Xitique precisa de pelo menos 3 pessoas.");
    const ids = members.map((row) => row.id);
    let order: string[];
    if (group.payoutMode === "sorteio") {
      order = drawOrder(group.drawSeed as string, ids);
    } else {
      order = input.order ?? ids;
      if (order.length !== ids.length || new Set(order).size !== ids.length || order.some((value) => !ids.includes(value))) {
        throw new DomainError("xitique_ordem", "A ordem tem de incluir cada membro uma vez.");
      }
    }
    for (const [index, memberId] of order.entries()) {
      await tx.update(xitiqueMembers).set({ position: index + 1 }).where(eq(xitiqueMembers.id, memberId));
    }
    for (const [index, memberId] of order.entries()) {
      const [round] = await tx
        .insert(xitiqueRounds)
        .values({ groupId, number: index + 1, dueDate: addDays(input.startsOn, index * STEP[group.frequency]), recipientMemberId: memberId })
        .returning();
      await tx.insert(xitiqueContributions).values(ids.map((id) => ({ roundId: round.id, memberId: id, amountCents: group.contributionCents })));
    }
    await tx.update(xitiqueGroups).set({ status: "activo", startsOn: input.startsOn }).where(eq(xitiqueGroups.id, groupId));
    await logEvent(tx, groupId, "grupo_iniciado", actor.id, group.payoutMode === "sorteio" ? "O sorteio foi feito e a ordem ficou fixada. Qualquer membro pode conferir." : "A ordem combinada ficou fixada.", {
      order,
      seed: group.payoutMode === "sorteio" ? group.drawSeed : undefined,
    });
  });
}

/** Called through the sync pipeline, so a member can declare without network. */
export async function declareContribution(tx: Tx, ctx: OperationContext, input: { contributionId: string; pocket?: string | null }) {
  const [row] = await tx
    .select({ contribution: xitiqueContributions, member: xitiqueMembers, round: xitiqueRounds })
    .from(xitiqueContributions)
    .innerJoin(xitiqueMembers, eq(xitiqueMembers.id, xitiqueContributions.memberId))
    .innerJoin(xitiqueRounds, eq(xitiqueRounds.id, xitiqueContributions.roundId))
    .where(eq(xitiqueContributions.id, input.contributionId))
    .for("update");
  if (!row) throw new DomainError("xitique_contribuicao", "Contribuição não encontrada.");
  const self = row.member.userId === ctx.userId;
  if (!self) {
    const actorMember = await membership(tx, row.round.groupId, ctx.userId);
    if (actorMember?.role !== "tesoureiro" || row.member.userId) throw new DomainError("xitique_acesso", "Só podes declarar a tua própria contribuição.");
  }
  if (row.contribution.status === "confirmada" || row.contribution.status === "declarada") return { conflicts: [] };
  const pocket = input.pocket === "casa" ? "casa" : "negocio";
  let entryId: string | undefined;
  if (self) {
    const entry = await postEntry(tx, {
      userId: ctx.userId,
      kind: "xitique_contribuicao",
      occurredAt: ctx.occurredAt,
      channel: ctx.channel,
      recordedBy: ctx.actorId,
      opId: ctx.opId,
      amountCents: row.contribution.amountCents,
      refType: "xitique_group",
      refId: row.round.groupId,
      lines: [
        { account: "xitique", amountCents: row.contribution.amountCents },
        { account: pocket, amountCents: -row.contribution.amountCents },
      ],
    });
    entryId = entry.id;
  }
  const lateDays = Math.max(0, Math.round((Date.parse(maputoDay(ctx.occurredAt)) - Date.parse(row.round.dueDate)) / 86_400_000));
  await tx
    .update(xitiqueContributions)
    .set({ status: "declarada", declaredAt: ctx.occurredAt, declaredBy: ctx.actorId, lateDays })
    .where(eq(xitiqueContributions.id, row.contribution.id));
  await logEvent(tx, row.round.groupId, "contribuicao_declarada", ctx.actorId, `${row.member.displayName} declarou ${formatMT(row.contribution.amountCents)} na ronda ${row.round.number}.`, { contributionId: row.contribution.id });
  return { entryId, conflicts: [] };
}

export async function confirmContribution(db: Db, actor: Actor, contributionId: string) {
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [row] = await tx
      .select({ contribution: xitiqueContributions, member: xitiqueMembers, round: xitiqueRounds })
      .from(xitiqueContributions)
      .innerJoin(xitiqueMembers, eq(xitiqueMembers.id, xitiqueContributions.memberId))
      .innerJoin(xitiqueRounds, eq(xitiqueRounds.id, xitiqueContributions.roundId))
      .where(eq(xitiqueContributions.id, contributionId))
      .for("update");
    if (!row) throw new DomainError("xitique_contribuicao", "Contribuição não encontrada.");
    const actorMember = await requireMember(tx, row.round.groupId, actor.id);
    // The manager or this round's recipient confirms, never the person who declared. If that leaves nobody (the only
    // manager declared for the round they receive themselves), any other member may confirm, so a second person exists.
    if (row.contribution.status !== "declarada") throw new DomainError("xitique_estado", "Esta contribuição ainda não foi declarada.");
    if (row.contribution.declaredBy === actor.id) throw new DomainError("xitique_duas_pessoas", "A confirmação tem de vir de outra pessoa.");
    const members = await tx.select().from(xitiqueMembers).where(eq(xitiqueMembers.groupId, row.round.groupId));
    if (!mayConfirmContribution(members, actor.id, row.round.recipientMemberId, row.contribution.declaredBy)) throw new DomainError("xitique_acesso", "Só quem gere o grupo ou quem recebe nesta ronda pode confirmar.");
    await tx.update(xitiqueContributions).set({ status: "confirmada", confirmedAt: new Date(), confirmedBy: actor.id }).where(eq(xitiqueContributions.id, contributionId));
    await logEvent(tx, row.round.groupId, "contribuicao_confirmada", actor.id, `${actor.displayName} confirmou a contribuição de ${row.member.displayName} na ronda ${row.round.number}.`);
  });
}

/** The recipient confirms receipt. This is what closes a round and posts the pot to their books. */
export async function confirmPayout(db: Db, actor: Actor, roundId: string, input: { receiptNote?: string } = {}) {
  await db.transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const [round] = await tx.select().from(xitiqueRounds).where(eq(xitiqueRounds.id, roundId)).for("update");
    if (!round) throw new DomainError("xitique_ronda", "Ronda não encontrada.");
    const actorMember = await requireMember(tx, round.groupId, actor.id);
    const [recipient] = await tx.select().from(xitiqueMembers).where(eq(xitiqueMembers.id, round.recipientMemberId));
    const recordedForOfflineMember = !recipient.userId && actorMember.role === "tesoureiro";
    if (round.recipientMemberId !== actorMember.id && !recordedForOfflineMember) throw new DomainError("xitique_acesso", "Só quem recebe pode confirmar o recebimento.");
    if (round.status === "paga") return;
    if (recordedForOfflineMember && (!input.receiptNote || input.receiptNote.trim().length < 10 || input.receiptNote.length > 4000)) throw new DomainError("xitique_recibo", "Regista como e a quem entregaste o valor.");
    const contributions = await tx.select().from(xitiqueContributions).where(eq(xitiqueContributions.roundId, roundId));
    const received = contributions.filter((row) => row.status === "confirmada").reduce((sum, row) => sum + row.amountCents, 0);
    if (!contributions.length || contributions.some((contribution) => contribution.status !== "confirmada")) throw new DomainError("xitique_estado", "Faltam contribuições confirmadas nesta ronda.");
    if (!recordedForOfflineMember) await postEntry(tx, {
      userId: actor.id,
      kind: "xitique_recebimento",
      occurredAt: new Date(),
      channel: "app",
      recordedBy: actor.id,
      amountCents: received,
      refType: "xitique_group",
      refId: round.groupId,
      memo: `Ronda ${round.number}`,
      lines: [
        { account: "negocio", amountCents: received },
        { account: "xitique", amountCents: -received },
      ],
    });
    await tx.update(xitiqueRounds).set({ status: "paga", paidOutAt: new Date(), paidOutConfirmedBy: actor.id }).where(eq(xitiqueRounds.id, roundId));
    await logEvent(tx, round.groupId, "ronda_paga", actor.id, recordedForOfflineMember
      ? `${actor.displayName} registou a entrega de ${formatMT(received)} a ${recipient.displayName} na ronda ${round.number}: ${input.receiptNote!.trim()}`
      : `${actor.displayName} confirmou que recebeu ${formatMT(received)} na ronda ${round.number}.`);
    const [next] = await tx.select({ id: xitiqueRounds.id }).from(xitiqueRounds).where(and(eq(xitiqueRounds.groupId, round.groupId), eq(xitiqueRounds.status, "aberta"))).limit(1);
    if (!next) {
      await tx.update(xitiqueGroups).set({ status: "concluido" }).where(eq(xitiqueGroups.id, round.groupId));
      await logEvent(tx, round.groupId, "grupo_concluido", null, "O ciclo terminou. Todas as rondas ficaram pagas.");
    }
  });
}

/** Daily job: contributions past their date become visible as late, and the member is told. */
export async function markLateContributions(db: Db, today = maputoDay()) {
  const late = await db
    .select({ id: xitiqueContributions.id, userId: xitiqueMembers.userId, amountCents: xitiqueContributions.amountCents, groupName: xitiqueGroups.name, dueDate: xitiqueRounds.dueDate })
    .from(xitiqueContributions)
    .innerJoin(xitiqueRounds, eq(xitiqueRounds.id, xitiqueContributions.roundId))
    .innerJoin(xitiqueMembers, eq(xitiqueMembers.id, xitiqueContributions.memberId))
    .innerJoin(xitiqueGroups, eq(xitiqueGroups.id, xitiqueRounds.groupId))
    .where(and(eq(xitiqueContributions.status, "pendente"), lt(xitiqueRounds.dueDate, today), eq(xitiqueGroups.status, "activo")));
  if (late.length === 0) return 0;
  await db.update(xitiqueContributions).set({ status: "atrasada" }).where(inArray(xitiqueContributions.id, late.map((row) => row.id)));
  for (const row of late) {
    if (row.userId) await notify(db, row.userId, { title: "Contribuição do Xitique em atraso", body: `${row.groupName}: faltam ${formatMT(row.amountCents)}.`, link: "/app/xitique" });
  }
  return late.length;
}

export async function listGroupsFor(db: Executor, userId: string) {
  const rows = await db
    .select({ group: xitiqueGroups, member: xitiqueMembers })
    .from(xitiqueMembers)
    .innerJoin(xitiqueGroups, eq(xitiqueGroups.id, xitiqueMembers.groupId))
    .where(and(eq(xitiqueMembers.userId, userId), eq(xitiqueMembers.status, "activo")))
    .orderBy(desc(xitiqueGroups.createdAt));
  return rows;
}

export async function groupDetail(db: Executor, groupId: string, userId: string | null) {
  if (userId) await requireMember(db, groupId, userId);
  const [group] = await db.select().from(xitiqueGroups).where(eq(xitiqueGroups.id, groupId)).limit(1);
  if (!group) throw new DomainError("xitique_grupo", "Grupo não encontrado.");
  const [members, rounds, contributions, events] = await Promise.all([
    db.select().from(xitiqueMembers).where(eq(xitiqueMembers.groupId, groupId)).orderBy(asc(xitiqueMembers.position), asc(xitiqueMembers.joinedAt)),
    db.select().from(xitiqueRounds).where(eq(xitiqueRounds.groupId, groupId)).orderBy(asc(xitiqueRounds.number)),
    db
      .select({ contribution: xitiqueContributions })
      .from(xitiqueContributions)
      .innerJoin(xitiqueRounds, eq(xitiqueRounds.id, xitiqueContributions.roundId))
      .where(eq(xitiqueRounds.groupId, groupId)),
    db
      .select({ event: xitiqueEvents, actorName: users.displayName })
      .from(xitiqueEvents)
      .leftJoin(users, eq(users.id, xitiqueEvents.actorId))
      .where(eq(xitiqueEvents.groupId, groupId))
      .orderBy(desc(xitiqueEvents.createdAt))
      .limit(60),
  ]);
  const byMember = new Map(members.map((member) => [member.id, member]));
  const myMember = userId ? (members.find((member) => member.userId === userId) ?? null) : null;
  const currentRound = rounds.find((round) => round.status !== "paga") ?? null;
  return {
    group: { ...group, drawSeed: group.status === "formacao" ? null : group.drawSeed },
    members,
    rounds: rounds.map((round) => ({
      ...round,
      recipientName: byMember.get(round.recipientMemberId)?.displayName ?? "—",
      contributions: contributions
        .map((row) => row.contribution)
        .filter((row) => row.roundId === round.id)
        .map((row) => ({ ...row, memberName: byMember.get(row.memberId)?.displayName ?? "—", canConfirm: Boolean(userId && row.status === "declarada" && mayConfirmContribution(members, userId, round.recipientMemberId, row.declaredBy)) })),
    })),
    currentRound,
    myMember,
    potCents: group.contributionCents * members.filter((member) => member.status === "activo").length,
    events: events.map((row) => ({ ...row.event, actorName: row.actorName })),
  };
}

export async function programmeXitiqueStats(db: Executor) {
  const [row] = await db
    .select({
      active: sql<string>`count(*) filter (where ${xitiqueGroups.status} = 'activo')`,
      total: sql<string>`count(*)`,
    })
    .from(xitiqueGroups);
  return { active: Number(row?.active ?? 0), total: Number(row?.total ?? 0) };
}
