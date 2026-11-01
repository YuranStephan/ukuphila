import "server-only";
import { z } from "zod";

const cents = z.number().int().positive().max(100_000_000_00);
const memo = z.string().trim().max(200).nullish();
const pocket = z.enum(["negocio", "casa"]).nullish();

/** Every merchant write is one of these. A sale at the stall and a replayed offline sale take exactly the same path. */
export const opPayloads = {
  "sale.record": z.object({ amountCents: cents, productId: z.uuid().nullish(), quantity: z.number().int().positive().max(100_000).nullish(), customerId: z.uuid().nullish(), memo }),
  "expense.record": z.object({ amountCents: cents, category: z.string().trim().min(1).max(40), pocket, memo }),
  "stock.purchase": z.object({ amountCents: cents, productId: z.uuid(), quantity: z.number().int().positive().max(100_000), pocket, memo }),
  "pocket.transfer": z.object({ from: z.enum(["negocio", "casa"]), to: z.enum(["negocio", "casa"]), amountCents: cents, memo }),
  "capital.in": z.object({ amountCents: cents, pocket, memo }),
  "product.upsert": z.object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(60),
    unit: z.string().trim().min(1).max(20),
    icon: z.string().trim().max(20).nullish(),
    salePriceCents: cents.nullish(),
    lowStockAt: z.number().int().min(0).max(100_000).nullish(),
    marketCategory: z.string().trim().max(40).nullish(),
  }),
  "stock.adjust": z.object({ productId: z.uuid(), quantity: z.number().int().min(0).max(100_000), reason: z.string().trim().min(2).max(120) }),
  "customer.upsert": z.object({ id: z.uuid(), name: z.string().trim().min(1).max(60), phone: z.string().trim().max(20).nullish(), note: z.string().trim().max(120).nullish() }),
  "fiado.repay": z.object({ customerId: z.uuid(), amountCents: cents, pocket, memo }),
  "savings.goal": z.object({ id: z.uuid(), name: z.string().trim().min(1).max(60), targetCents: cents, targetDate: z.string().date().nullish() }),
  "savings.deposit": z.object({ amountCents: cents, goalId: z.uuid().nullish(), pocket, memo }),
  "savings.withdraw": z.object({ amountCents: cents, goalId: z.uuid().nullish(), pocket, memo }),
  "entry.reverse": z.object({ entryId: z.uuid(), reason: z.string().trim().min(2).max(200) }),
  "xitique.declare": z.object({ contributionId: z.uuid(), pocket }),
} as const;

export type OpType = keyof typeof opPayloads;

export const incomingOp = z.object({
  opId: z.uuid(),
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
  channel: z.enum(["app", "voz"]).default("app"),
  clientTime: z.iso.datetime(),
  deviceSeq: z.number().int().positive(),
  prevHash: z.string().length(64),
  hash: z.string().length(64),
  signature: z.string().min(16).max(256),
});

export type IncomingOp = z.infer<typeof incomingOp>;
