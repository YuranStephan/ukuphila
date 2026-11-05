import { maputoDay } from "@/lib/dates";
import type { QueuedOp } from "./engine";

/*
 * Draws pending records on top of the last snapshot, so the screen moves the moment the person taps, with or without
 * network. It mirrors the server's postings in a simplified way; the server's answer always replaces it on sync.
 */

type Entry = { id: string; kind: string; amountCents: number; occurredAt: string | Date; channel: string; memo: string | null; category: string | null; quantity: number | null; productId: string | null; customerId: string | null; reversesId: string | null; needsReview: boolean; reviewNote: string | null; opId: string | null; pending?: boolean };

export type SnapshotShape = {
  today: string;
  pockets: { negocio: number; casa: number; poupanca: number; xitique: number };
  books: { stockValue: number; fiadoReceivable: number };
  daily: { day: string; salesCents: number; expensesCents: number; purchasesCents: number }[];
  entries: Entry[];
  products: { id: string; name: string; unit: string; icon: string; quantity: number; lowStockAt: number; salePriceCents: number | null; avgCostCents: number; marketCategory: string | null }[];
  customers: { id: string; name: string; phone: string | null; note: string | null; owedCents: number; oldestAt: string | null; lastAt: string | null }[];
  goals: { id: string; name: string; targetCents: number; targetDate: string | null; status: string; savedCents: number }[];
  xitique: { id: string; nextDue: { contributionId: string; status: string; amountCents: number } | null }[];
};

const KIND: Record<string, string> = {
  "sale.record": "venda",
  "expense.record": "despesa",
  "stock.purchase": "compra_stock",
  "pocket.transfer": "transferencia",
  "capital.in": "entrada_capital",
  "fiado.repay": "fiado_recebido",
  "savings.deposit": "poupanca_deposito",
  "savings.withdraw": "poupanca_levantamento",
  "xitique.declare": "xitique_contribuicao",
};

export function applyPending<T extends SnapshotShape>(snapshot: T, ops: QueuedOp[]): T {
  if (ops.length === 0) return snapshot;
  const next: T = structuredClone(snapshot);
  const pockets = next.pockets as Record<string, number>;
  const bump = (day: string, field: "salesCents" | "expensesCents" | "purchasesCents", cents: number) => {
    let row = next.daily.find((item) => item.day === day);
    if (!row) {
      row = { day, salesCents: 0, expensesCents: 0, purchasesCents: 0 };
      next.daily.push(row);
    }
    row[field] += cents;
  };

  for (const op of ops) {
    const p = op.payload as Record<string, unknown>;
    const amount = typeof p.amountCents === "number" ? p.amountCents : 0;
    const day = maputoDay(new Date(op.clientTime));
    const pocket = (p.pocket as string) || "negocio";
    switch (op.type) {
      case "sale.record": {
        if (p.customerId) {
          next.books.fiadoReceivable += amount;
          const customer = next.customers.find((row) => row.id === p.customerId);
          if (customer) customer.owedCents += amount;
        } else pockets.negocio += amount;
        bump(day, "salesCents", amount);
        const product = next.products.find((row) => row.id === p.productId);
        if (product && typeof p.quantity === "number") product.quantity = Math.max(0, product.quantity - p.quantity);
        break;
      }
      case "expense.record":
        pockets[pocket] -= amount;
        bump(day, "expensesCents", amount);
        break;
      case "stock.purchase": {
        pockets[pocket] -= amount;
        bump(day, "purchasesCents", amount);
        const product = next.products.find((row) => row.id === p.productId);
        if (product && typeof p.quantity === "number") product.quantity += p.quantity;
        break;
      }
      case "pocket.transfer":
        pockets[p.from as string] -= amount;
        pockets[p.to as string] += amount;
        break;
      case "capital.in":
        pockets[pocket] += amount;
        break;
      case "fiado.repay": {
        pockets[pocket] += amount;
        next.books.fiadoReceivable -= amount;
        const customer = next.customers.find((row) => row.id === p.customerId);
        if (customer) customer.owedCents -= amount;
        break;
      }
      case "savings.deposit": {
        pockets[pocket] -= amount;
        pockets.poupanca += amount;
        const goal = next.goals.find((row) => row.id === p.goalId);
        if (goal) goal.savedCents += amount;
        break;
      }
      case "savings.withdraw":
        pockets.poupanca -= amount;
        pockets[(p.pocket as string) || "casa"] += amount;
        break;
      case "product.upsert": {
        const existing = next.products.find((row) => row.id === p.id);
        const values = { name: String(p.name), unit: String(p.unit), icon: String(p.icon ?? "caixa"), salePriceCents: (p.salePriceCents as number) ?? null, lowStockAt: (p.lowStockAt as number) ?? 5, marketCategory: (p.marketCategory as string) ?? null };
        if (existing) Object.assign(existing, values);
        else next.products.push({ id: String(p.id), quantity: 0, avgCostCents: 0, ...values });
        break;
      }
      case "stock.adjust": {
        const product = next.products.find((row) => row.id === p.productId);
        if (product) product.quantity = Number(p.quantity);
        break;
      }
      case "customer.upsert": {
        const existing = next.customers.find((row) => row.id === p.id);
        if (existing) Object.assign(existing, { name: p.name, phone: p.phone ?? null, note: p.note ?? null });
        else next.customers.push({ id: String(p.id), name: String(p.name), phone: (p.phone as string) ?? null, note: (p.note as string) ?? null, owedCents: 0, oldestAt: null, lastAt: null });
        break;
      }
      case "savings.goal": {
        const existing = next.goals.find((row) => row.id === p.id);
        if (existing) Object.assign(existing, { name: p.name, targetCents: p.targetCents });
        else next.goals.push({ id: String(p.id), name: String(p.name), targetCents: Number(p.targetCents), targetDate: (p.targetDate as string) ?? null, status: "activa", savedCents: 0 });
        break;
      }
      case "xitique.declare": {
        const group = next.xitique.find((row) => row.nextDue?.contributionId === p.contributionId);
        if (group?.nextDue) {
          group.nextDue.status = "declarada";
          pockets[pocket] -= group.nextDue.amountCents;
          pockets.xitique += group.nextDue.amountCents;
        }
        break;
      }
      case "entry.reverse": {
        const original = next.entries.find((row) => row.id === p.entryId);
        if (original) original.reversesId = "pendente";
        break;
      }
    }
    if (KIND[op.type]) {
      next.entries.unshift({
        id: `pendente-${op.opId}`,
        kind: KIND[op.type],
        amountCents: amount,
        occurredAt: op.clientTime,
        channel: op.channel,
        memo: (p.memo as string) ?? null,
        category: (p.category as string) ?? null,
        quantity: (p.quantity as number) ?? null,
        productId: (p.productId as string) ?? null,
        customerId: (p.customerId as string) ?? null,
        reversesId: null,
        needsReview: false,
        reviewNote: null,
        opId: op.opId,
        pending: true,
      });
    }
  }
  return next;
}
