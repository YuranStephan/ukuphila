import "server-only";
import { eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { accounts, type AccountCode } from "../db/schema";

export const POCKETS = ["negocio", "casa", "poupanca", "xitique"] as const;
export type Pocket = (typeof POCKETS)[number];

const DEFINITIONS: { code: AccountCode; kind: "bolso" | "activo" | "passivo" | "resultado" }[] = [
  { code: "negocio", kind: "bolso" },
  { code: "casa", kind: "bolso" },
  { code: "poupanca", kind: "bolso" },
  { code: "xitique", kind: "bolso" },
  { code: "stock", kind: "activo" },
  { code: "fiado", kind: "activo" },
  { code: "receita", kind: "resultado" },
  { code: "custo_vendas", kind: "resultado" },
  { code: "despesas", kind: "resultado" },
  { code: "capital", kind: "passivo" },
  { code: "divida_fornecedor", kind: "passivo" },
  { code: "correccoes", kind: "resultado" },
];

export async function ensureAccounts(db: Executor, userId: string) {
  await db
    .insert(accounts)
    .values(DEFINITIONS.map((definition) => ({ userId, ...definition })))
    .onConflictDoNothing();
}

export async function accountMap(db: Executor, userId: string) {
  const rows = await db.select({ id: accounts.id, code: accounts.code }).from(accounts).where(eq(accounts.userId, userId));
  return new Map(rows.map((row) => [row.code, row.id]));
}
