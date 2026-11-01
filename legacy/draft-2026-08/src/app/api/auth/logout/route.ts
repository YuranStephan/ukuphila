import { limparSessao } from "@/lib/auth";
import { json } from "@/lib/http";

export async function POST() {
  await limparSessao();
  return json({ ok: true });
}
