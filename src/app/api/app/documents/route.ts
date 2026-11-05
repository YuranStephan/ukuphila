import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { submitDocument } from "@/server/kyc/service";
import { jsonError, merchantOr401 } from "../_auth";

export async function POST(request: Request) {
  const user = await merchantOr401(request);
  if (user instanceof NextResponse) return user;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Escolhe a fotografia do documento." }, { status: 400 });
    const document = await submitDocument(await getDb(), user, {
      userId: user.id,
      type: String(form.get("type") ?? ""),
      number: String(form.get("number") ?? "") || null,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({ id: document.id, status: document.status });
  } catch (error) {
    return jsonError(error);
  }
}
