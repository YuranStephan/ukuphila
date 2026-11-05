import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { SignInSwitcher } from "@/components/auth-forms";
import { homeFor } from "@/server/auth/permissions";
import { currentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await currentUser();
  if (user) redirect(next ?? homeFor(user.role));
  return (
    <AuthShell quote="O teu negócio, com memória.">
      <h1>Entrar</h1>
      <SignInSwitcher next={next} />
      <p className="small muted">
        Ainda não tens conta? <Link href="/registar">Cria a tua</Link> ou fala com um agente no teu mercado.
      </p>
    </AuthShell>
  );
}
