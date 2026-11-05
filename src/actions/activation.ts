"use server";

import { redirect } from "next/navigation";
import { agentProfile, assertAssigned } from "@/server/agent/service";
import { activateWithCode, issueActivationCode, loginStep, signInWithPin, type LoginStep } from "@/server/auth/activation";
import { homeFor } from "@/server/auth/permissions";
import { createSession, requireApi } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { publicMessage } from "@/server/errors";
import type { ActionState } from "./state";

export type ActivationState = ActionState & { code?: string };

/** Agents issue codes for their own merchants; admins can issue for anyone, and both leave an audit line. */
export async function issueActivationCodeAction(merchantId: string, _: ActivationState): Promise<ActivationState> {
  try {
    const user = await requireApi(["agent", "admin"]);
    const db = await getDb();
    if (user.role === "agent") {
      const agent = await agentProfile(db, user.id);
      await assertAssigned(db, agent.id, merchantId);
    }
    // Admins issue codes for merchants, agents and suppliers; issueActivationCode re-checks the target's role.
    const code = await issueActivationCode(db, user, merchantId);
    return { ok: true, code };
  } catch (error) {
    return { error: publicMessage(error) };
  }
}

export type PhoneLoginState = ActionState & { step?: LoginStep };

export async function phoneStepAction(_: PhoneLoginState, form: FormData): Promise<PhoneLoginState> {
  try {
    const step = await loginStep(await getDb(), String(form.get("phone") ?? ""));
    return { ok: true, step };
  } catch (error) {
    return { error: publicMessage(error) };
  }
}

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function pinLoginAction(previous: PhoneLoginState, form: FormData): Promise<PhoneLoginState> {
  let destination = "/app";
  try {
    const db = await getDb();
    const user = await signInWithPin(db, String(form.get("phone") ?? ""), String(form.get("pin") ?? ""));
    await createSession(db, user.id, user.role);
    destination = safeNext(form.get("next")) ?? homeFor(user.role);
  } catch (error) {
    return { ...previous, error: publicMessage(error) };
  }
  redirect(destination);
}

export async function activationLoginAction(previous: PhoneLoginState, form: FormData): Promise<PhoneLoginState> {
  let destination = "/app";
  try {
    const db = await getDb();
    const pin = String(form.get("pin") ?? "");
    if (pin !== String(form.get("pinConfirm") ?? "")) return { ...previous, error: "Os dois PIN não são iguais." };
    const user = await activateWithCode(db, String(form.get("phone") ?? ""), String(form.get("code") ?? ""), pin);
    await createSession(db, user.id, user.role);
    destination = safeNext(form.get("next")) ?? homeFor(user.role);
  } catch (error) {
    return { ...previous, error: publicMessage(error) };
  }
  redirect(destination);
}
