import { revalidatePath } from "next/cache";
import { publicMessage } from "@/server/errors";
import type { ActionState } from "./state";

/** Every staff action: run, report a safe message, refresh what the action touched. */
export async function run(work: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await work();
    revalidatePath("/", "layout");
    return { ok: true, message: message ?? undefined };
  } catch (error) {
    return { error: publicMessage(error) };
  }
}
