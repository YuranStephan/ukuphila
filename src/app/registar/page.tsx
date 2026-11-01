import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "@/components/auth-forms";
import { getDb } from "@/server/db/client";
import { markets } from "@/server/db/schema";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignupPage() {
  const db = await getDb();
  const rows = await db.select({ id: markets.id, name: markets.name }).from(markets).orderBy(markets.name);
  return (
    <AuthShell quote="Começa pelo que já sabes fazer: vender.">
      <h1>Criar conta</h1>
      <p className="muted">São só alguns dados. O teu agente ajuda com o resto.</p>
      <SignupForm markets={rows} />
      <p className="small muted">
        Já tens conta? <Link href="/entrar">Entra aqui</Link>.
      </p>
    </AuthShell>
  );
}
