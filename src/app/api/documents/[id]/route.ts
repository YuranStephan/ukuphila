import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { openDocument } from "@/server/kyc/service";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await context.params;
  try {
    const { document, bytes } = await openDocument(await getDb(), user, id);
    if (!bytes) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": document.mime ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
        // A stored file can never run as part of this site.
        "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) return new NextResponse(null, { status: 403 });
    throw error;
  }
}
