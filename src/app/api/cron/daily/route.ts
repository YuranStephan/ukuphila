import { NextResponse } from "next/server";
import { safeEqual } from "@/server/crypto";
import { markOverdue } from "@/server/credit/service";
import { getDb } from "@/server/db/client";
import { runRiskRules } from "@/server/risk/rules";
import { markLateContributions } from "@/server/xitique/service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new Response(null, { status: 401 });
  try {
    const db = await getDb();
    const credit = await markOverdue(db);
    const xitique = await markLateContributions(db);
    const risk = await runRiskRules(db);
    return NextResponse.json({ credit, xitique, risk }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível concluir a rotina diária." }, { status: 500 });
  }
}
