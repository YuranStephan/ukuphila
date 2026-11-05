import { redirect } from "next/navigation";
import { requirePage } from "@/server/auth/session";

export default async function EquityPage() {
  await requirePage("risk.read");
  redirect("/risco/governacao");
}
