"use server";

import { parseAmountToCents } from "@/lib/money";
import { addSupplierProduct, assignMerchant, changePassword, createAgent, createSupplier, setSupplierProductActive } from "@/server/admin/people";
import { requireApi } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { run } from "./run";
import type { ActionState } from "./state";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function assignMerchantAction(merchantId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("team.manage");
    await assignMerchant(await getDb(), user, merchantId, text(form, "agentId"));
    return "Agente atribuído. O comerciante já aparece na carteira desse agente.";
  });
}

export async function createAgentAction(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("team.manage");
    await createAgent(await getDb(), user, { name: text(form, "name"), phone: text(form, "phone"), marketId: text(form, "marketId"), kiosk: text(form, "kiosk"), hours: text(form, "hours") || null });
    return "Agente criado. Gera o código de entrada na lista para o agente criar o PIN.";
  });
}

export async function createSupplierAction(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("team.manage");
    await createSupplier(await getDb(), user, { name: text(form, "name"), category: text(form, "category"), phone: text(form, "phone") });
    return "Fornecedor criado. Acrescenta o catálogo e gera o código de entrada.";
  });
}

export async function addSupplierProductAction(supplierId: string, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi("team.manage");
    const priceCents = parseAmountToCents(text(form, "price"));
    if (!priceCents) throw new DomainError("produto", "Indica o preço.");
    await addSupplierProduct(await getDb(), user, supplierId, { name: text(form, "name"), unit: text(form, "unit"), priceCents });
  });
}

export async function toggleSupplierProductAction(supplierId: string, productId: string, active: boolean) {
  await requireApi("team.manage");
  await setSupplierProductActive(await getDb(), supplierId, productId, active);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/gestao/fornecedores");
}

export async function changePasswordAction(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireApi(["admin", "auditor", "kyc_reviewer", "credit_analyst", "credit_approver", "risk_analyst"]);
    if (text(form, "next") !== text(form, "confirm")) throw new DomainError("palavra_passe", "As duas palavras-passe novas não são iguais.");
    await changePassword(await getDb(), user, String(form.get("current") ?? ""), String(form.get("next") ?? ""));
    return "Palavra-passe alterada.";
  });
}
