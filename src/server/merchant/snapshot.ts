import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { addDays, daysAgo, maputoDay } from "@/lib/dates";
import { rowsOf, type Executor } from "../db/client";
import {
  agents,
  businesses,
  consents,
  creditApplications,
  creditContracts,
  creditInstalments,
  customers,
  deviceLeases,
  documents,
  journalEntries,
  kycProfiles,
  leasePayments,
  markets,
  notifications,
  passports,
  products,
  savingsGoals,
  supplierProducts,
  suppliers,
  syncConflicts,
  users,
  xitiqueContributions,
  xitiqueGroups,
  xitiqueMembers,
  xitiqueRounds,
} from "../db/schema";
import { getSetting } from "../settings";
import { trustFor } from "../trust/facts";

/**
 * Everything the merchant app needs to work with no network. The device stores this document and draws every screen
 * from it plus its local queue, so this is the single read contract of the PWA.
 */
export async function buildSnapshot(db: Executor, userId: string) {
  const now = new Date();
  const today = maputoDay(now);
  const since = daysAgo(35, now);

  const [[owner], balances, daily, entries, productRows, customerRows, goalRows, trust, unread, conflicts, offlinePolicy, documentRows, consentRows, passportRows, kyc] = await Promise.all([
    db
      .select({
        id: users.id,
        displayName: users.displayName,
        phone: users.phone,
        status: users.status,
        hasPin: sql<boolean>`${users.pinHash} is not null`,
        isDemo: users.isDemo,
        businessName: businesses.name,
        stall: businesses.stall,
        activity: businesses.activity,
        marketName: markets.name,
        marketId: markets.id,
        agentId: businesses.agentId,
      })
      .from(users)
      .innerJoin(businesses, eq(businesses.ownerId, users.id))
      .innerJoin(markets, eq(markets.id, businesses.marketId))
      .where(eq(users.id, userId))
      .limit(1),
    db.execute(sql`
      select a.code, coalesce(sum(p.amount_cents), 0) as balance
      from ukuphila.accounts a left join ukuphila.postings p on p.account_id = a.id
      where a.user_id = ${userId}
      group by a.code
    `),
    db.execute(sql`
      select (e.occurred_at at time zone 'Africa/Maputo')::date::text as day,
        coalesce(sum(case when e.kind in ('venda','venda_fiado') then e.amount_cents end), 0) as sales,
        coalesce(sum(case when e.kind = 'despesa' then e.amount_cents end), 0) as expenses,
        coalesce(sum(case when e.kind = 'compra_stock' then e.amount_cents end), 0) as purchases
      from ukuphila.journal_entries e
      where e.user_id = ${userId} and e.occurred_at >= ${since.toISOString()}::timestamptz
        and not exists (select 1 from ukuphila.journal_entries r where r.reverses_id = e.id)
      group by 1 order by 1
    `),
    db
      .select({
        id: journalEntries.id,
        kind: journalEntries.kind,
        amountCents: journalEntries.amountCents,
        occurredAt: journalEntries.occurredAt,
        channel: journalEntries.channel,
        memo: journalEntries.memo,
        category: journalEntries.category,
        quantity: journalEntries.quantity,
        productId: journalEntries.productId,
        customerId: journalEntries.customerId,
        reversesId: journalEntries.reversesId,
        needsReview: journalEntries.needsReview,
        reviewNote: journalEntries.reviewNote,
        opId: journalEntries.opId,
      })
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.occurredAt), desc(journalEntries.seq))
      .limit(120),
    db.select().from(products).where(and(eq(products.userId, userId), eq(products.archived, false))).orderBy(products.name),
    db.execute(sql`
      select c.id, c.name, c.phone, c.note,
        coalesce(sum(case e.kind when 'venda_fiado' then e.amount_cents when 'fiado_recebido' then -e.amount_cents else 0 end), 0) as owed,
        min(e.occurred_at) filter (where e.kind = 'venda_fiado') as oldest,
        max(e.occurred_at) as last_at
      from ukuphila.customers c
      left join ukuphila.journal_entries e on e.customer_id = c.id and e.kind <> 'estorno'
        and not exists (select 1 from ukuphila.journal_entries r where r.reverses_id = e.id)
      where c.user_id = ${userId}
      group by c.id order by owed desc, c.name
    `),
    db.execute(sql`
      select g.id, g.name, g.target_cents, g.target_date::text as target_date, g.status,
        coalesce(sum(case e.kind when 'poupanca_deposito' then e.amount_cents when 'poupanca_levantamento' then -e.amount_cents else 0 end), 0) as saved
      from ukuphila.savings_goals g
      left join ukuphila.journal_entries e on e.goal_id = g.id and e.kind <> 'estorno'
        and not exists (select 1 from ukuphila.journal_entries r where r.reverses_id = e.id)
      where g.user_id = ${userId}
      group by g.id order by g.created_at
    `),
    trustFor(db, userId),
    db.select({ total: sql<string>`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
    db.select().from(syncConflicts).where(and(eq(syncConflicts.userId, userId), eq(syncConflicts.status, "aberto"))).orderBy(desc(syncConflicts.createdAt)).limit(20),
    getSetting(db, "offlinePolicy"),
    db
      .select({ id: documents.id, type: documents.type, status: documents.status, version: documents.version, rejectionReason: documents.rejectionReason, rejectionNote: documents.rejectionNote, numberMasked: documents.numberMasked, submittedAt: documents.submittedAt, reviewedAt: documents.reviewedAt, expiryDate: documents.expiryDate })
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt)),
    db.select().from(consents).where(eq(consents.userId, userId)).orderBy(desc(consents.grantedAt)),
    db.select({ id: passports.id, code: passports.code, audience: passports.audience, scope: passports.scope, views: passports.views, expiresAt: passports.expiresAt, revokedAt: passports.revokedAt, createdAt: passports.createdAt }).from(passports).where(eq(passports.userId, userId)).orderBy(desc(passports.createdAt)).limit(10),
    db.select().from(kycProfiles).where(eq(kycProfiles.userId, userId)).limit(1),
  ]);

  const [agent] = owner?.agentId
    ? await db
        .select({ name: users.displayName, phone: users.phone, kiosk: agents.kioskName, hours: agents.kioskHours })
        .from(agents)
        .innerJoin(users, eq(users.id, agents.userId))
        .where(eq(agents.id, owner.agentId))
        .limit(1)
    : [null];

  const balanceRows = rowsOf<{ code: string; balance: string }>(balances);
  const balanceOf = (code: string) => Number(balanceRows.find((row) => row.code === code)?.balance ?? 0);
  const result = {
    revenue: -balanceOf("receita"),
    cost: balanceOf("custo_vendas"),
    expenses: balanceOf("despesas"),
  };

  const dailyRows = rowsOf<{ day: string; sales: string; expenses: string; purchases: string }>(daily).map((row) => ({
    day: row.day,
    salesCents: Number(row.sales),
    expensesCents: Number(row.expenses),
    purchasesCents: Number(row.purchases),
  }));

  // Costs follow the same cut-off as sales, so "lucro estimado" over a period compares like with like.
  const [margin] = rowsOf<{ cost: string; known: string; revenue: string }>(
    await db.execute(sql`
      select
        coalesce(sum(case when e.category = 'custo_conhecido' then e.amount_cents end), 0) as known,
        coalesce(sum(e.amount_cents), 0) as revenue,
        coalesce(sum(p.quantity_cost), 0) as cost
      from ukuphila.journal_entries e
      left join lateral (
        select sum(po.amount_cents) as quantity_cost from ukuphila.postings po
        join ukuphila.accounts a on a.id = po.account_id and a.code = 'custo_vendas'
        where po.entry_id = e.id
      ) p on true
      where e.user_id = ${userId} and e.kind in ('venda','venda_fiado') and e.occurred_at >= ${daysAgo(30, now).toISOString()}::timestamptz
        and not exists (select 1 from ukuphila.journal_entries r where r.reverses_id = e.id)
    `),
  );

  const xitique = await merchantXitique(db, userId, today);
  const credit = await merchantCredit(db, userId);
  const lease = await merchantLease(db, userId);

  return {
    serverTime: now.toISOString(),
    today,
    owner,
    agent: agent ?? null,
    kyc: kyc[0] ? { level: kyc[0].level, status: kyc[0].status } : { level: 0, status: "por_iniciar" },
    pockets: { negocio: balanceOf("negocio"), casa: balanceOf("casa"), poupanca: balanceOf("poupanca"), xitique: balanceOf("xitique") },
    books: { stockValue: balanceOf("stock"), fiadoReceivable: balanceOf("fiado"), supplierDebt: -balanceOf("divida_fornecedor"), ...result },
    daily: dailyRows,
    margin30: { revenue: Number(margin?.revenue ?? 0), known: Number(margin?.known ?? 0), cost: Number(margin?.cost ?? 0) },
    entries,
    products: productRows,
    customers: rowsOf<{ id: string; name: string; phone: string | null; note: string | null; owed: string; oldest: string | null; last_at: string | null }>(customerRows).map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      note: row.note,
      owedCents: Number(row.owed),
      oldestAt: row.oldest,
      lastAt: row.last_at,
    })),
    goals: rowsOf<{ id: string; name: string; target_cents: string; target_date: string | null; status: string; saved: string }>(goalRows).map((row) => ({
      id: row.id,
      name: row.name,
      targetCents: Number(row.target_cents),
      targetDate: row.target_date,
      status: row.status,
      savedCents: Number(row.saved),
    })),
    trust,
    xitique,
    credit,
    lease,
    documents: documentRows,
    consents: consentRows,
    passports: passportRows,
    unreadNotifications: Number(unread[0]?.total ?? 0),
    conflicts,
    offlinePolicy,
  };
}

export type MerchantSnapshot = Awaited<ReturnType<typeof buildSnapshot>>;

async function merchantXitique(db: Executor, userId: string, today: string) {
  const rows = await db
    .select({ group: xitiqueGroups, member: xitiqueMembers })
    .from(xitiqueMembers)
    .innerJoin(xitiqueGroups, eq(xitiqueGroups.id, xitiqueMembers.groupId))
    .where(and(eq(xitiqueMembers.userId, userId), eq(xitiqueMembers.status, "activo")));
  if (rows.length === 0) return [];
  const groupIds = rows.map((row) => row.group.id);
  const [rounds, memberCounts, mine] = await Promise.all([
    db
      .select({ round: xitiqueRounds, recipientName: xitiqueMembers.displayName, recipientUserId: xitiqueMembers.userId })
      .from(xitiqueRounds)
      .innerJoin(xitiqueMembers, eq(xitiqueMembers.id, xitiqueRounds.recipientMemberId))
      .where(inArray(xitiqueRounds.groupId, groupIds))
      .orderBy(xitiqueRounds.number),
    db
      .select({ groupId: xitiqueMembers.groupId, total: sql<string>`count(*)` })
      .from(xitiqueMembers)
      .where(and(inArray(xitiqueMembers.groupId, groupIds), eq(xitiqueMembers.status, "activo")))
      .groupBy(xitiqueMembers.groupId),
    db
      .select({ contribution: xitiqueContributions, groupId: xitiqueRounds.groupId, number: xitiqueRounds.number, dueDate: xitiqueRounds.dueDate })
      .from(xitiqueContributions)
      .innerJoin(xitiqueRounds, eq(xitiqueRounds.id, xitiqueContributions.roundId))
      .innerJoin(xitiqueMembers, eq(xitiqueMembers.id, xitiqueContributions.memberId))
      .where(and(inArray(xitiqueRounds.groupId, groupIds), eq(xitiqueMembers.userId, userId))),
  ]);
  return rows.map(({ group, member }) => {
    const groupRounds = rounds.filter((row) => row.round.groupId === group.id);
    const current = groupRounds.find((row) => row.round.status !== "paga") ?? null;
    const myContributions = mine.filter((row) => row.groupId === group.id);
    const pending = myContributions
      .filter((row) => row.contribution.status === "pendente" || row.contribution.status === "atrasada")
      .sort((a, b) => a.number - b.number)[0];
    const members = Number(memberCounts.find((row) => row.groupId === group.id)?.total ?? 0);
    return {
      id: group.id,
      name: group.name,
      code: group.code,
      status: group.status,
      frequency: group.frequency,
      contributionCents: group.contributionCents,
      members,
      potCents: group.contributionCents * members,
      role: member.role,
      myPosition: member.position,
      rounds: groupRounds.length,
      currentRound: current ? { id: current.round.id, number: current.round.number, dueDate: current.round.dueDate, recipientName: current.recipientName, isMine: current.recipientUserId === userId } : null,
      nextDue: pending ? { contributionId: pending.contribution.id, amountCents: pending.contribution.amountCents, dueDate: pending.dueDate, status: pending.contribution.status, round: pending.number, late: pending.dueDate < today } : null,
      paidOnTime: myContributions.filter((row) => row.contribution.status === "confirmada" && row.contribution.lateDays === 0).length,
      paidTotal: myContributions.filter((row) => row.contribution.status === "confirmada").length,
    };
  });
}

async function merchantCredit(db: Executor, userId: string) {
  const [applications, contracts, supplierRows] = await Promise.all([
    db
      .select({ application: creditApplications, supplierName: suppliers.name })
      .from(creditApplications)
      .innerJoin(suppliers, eq(suppliers.id, creditApplications.supplierId))
      .where(eq(creditApplications.userId, userId))
      .orderBy(desc(creditApplications.createdAt))
      .limit(10),
    db
      .select({ contract: creditContracts, supplierName: suppliers.name })
      .from(creditContracts)
      .innerJoin(suppliers, eq(suppliers.id, creditContracts.supplierId))
      .where(eq(creditContracts.userId, userId))
      .orderBy(desc(creditContracts.createdAt))
      .limit(10),
    db.select().from(suppliers).where(eq(suppliers.status, "activo")),
  ]);
  const contractIds = contracts.map((row) => row.contract.id);
  const instalments = contractIds.length
    ? await db.select().from(creditInstalments).where(inArray(creditInstalments.contractId, contractIds)).orderBy(creditInstalments.number)
    : [];
  const catalogue = await db.select().from(supplierProducts).where(eq(supplierProducts.active, true));
  return {
    applications: applications.map((row) => ({
      id: row.application.id,
      code: row.application.code,
      status: row.application.status,
      supplierName: row.supplierName,
      requestedCents: row.application.requestedCents,
      offeredCents: row.application.offeredCents,
      offeredFeeCents: row.application.offeredFeeCents,
      offeredTermDays: row.application.offeredTermDays,
      offeredInstalments: row.application.offeredInstalments,
      items: row.application.items,
      createdAt: row.application.createdAt,
    })),
    contracts: contracts.map((row) => ({
      id: row.contract.id,
      code: row.contract.code,
      status: row.contract.status,
      supplierName: row.supplierName,
      principalCents: row.contract.principalCents,
      feeCents: row.contract.feeCents,
      termDays: row.contract.termDays,
      deliveryCode: row.contract.status === "aguarda_entrega" ? row.contract.deliveryCode : null,
      acceptedAt: row.contract.acceptedAt,
      instalments: instalments.filter((item) => item.contractId === row.contract.id).map((item) => ({ number: item.number, dueDate: item.dueDate, amountCents: item.amountCents, paidCents: item.paidCents, status: item.status })),
    })),
    suppliers: supplierRows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      products: catalogue.filter((item) => item.supplierId === row.id).map((item) => ({ id: item.id, name: item.name, unit: item.unit, priceCents: item.priceCents })),
    })),
  };
}

async function merchantLease(db: Executor, userId: string) {
  const [lease] = await db.select().from(deviceLeases).where(and(eq(deviceLeases.userId, userId), inArray(deviceLeases.status, ["activo", "em_atraso"]))).limit(1);
  if (!lease) return null;
  const payments = await db.select().from(leasePayments).where(eq(leasePayments.leaseId, lease.id)).orderBy(leasePayments.number);
  const next = payments.find((payment) => payment.status !== "pago");
  return {
    code: lease.code,
    status: lease.status,
    instalments: lease.instalments,
    paid: payments.filter((payment) => payment.status === "pago").length,
    instalmentCents: lease.instalmentCents,
    isExampleTerms: lease.isExampleTerms,
    next: next ? { dueDate: next.dueDate, amountCents: next.amountCents, status: next.status } : null,
  };
}

/** Market pulse: a figure only appears when at least `minMerchants` different people contributed to it. */
export async function marketPulse(db: Executor, marketId: string, minMerchants: number) {
  const since = addDays(maputoDay(), -14);
  const rows = rowsOf<{ category: string; merchants: string; avg_price: string; units: string }>(
    await db.execute(sql`
      select p.market_category as category, count(distinct e.user_id) as merchants,
        round(sum(e.amount_cents)::numeric / nullif(sum(e.quantity), 0)) as avg_price, sum(e.quantity) as units
      from ukuphila.journal_entries e
      join ukuphila.products p on p.id = e.product_id
      join ukuphila.businesses b on b.owner_id = e.user_id
      where b.market_id = ${marketId} and e.kind in ('venda','venda_fiado') and e.quantity > 0
        and p.market_category is not null and e.occurred_at >= ${since}::date
      group by p.market_category
      having count(distinct e.user_id) >= ${minMerchants}
      order by units desc limit 8
    `),
  );
  return rows.map((row) => ({ category: row.category, merchants: Number(row.merchants), avgPriceCents: Number(row.avg_price), units: Number(row.units) }));
}
