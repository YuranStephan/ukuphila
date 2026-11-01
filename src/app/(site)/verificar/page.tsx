import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/site/page-hero";

export const metadata: Metadata = { title: "Verificar um passaporte" };

async function go(form: FormData) {
  "use server";
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (code) redirect(`/h/${encodeURIComponent(code)}`);
}

export default function VerifyPage() {
  return (
    <>
      <PageHero eyebrow="Verificar" title="Recebeu um passaporte do negócio?" lead="Escreva o código ou leia o QR. Vai ver apenas o que o comerciante decidiu mostrar, enquanto o passaporte for válido." />
      <section className="section">
        <div className="container-narrow">
          <form action={go} className="card row wrap">
            <input className="input grow" name="code" placeholder="Código do passaporte" aria-label="Código do passaporte" required style={{ minWidth: 200 }} />
            <button className="btn btn-primary" type="submit">
              Verificar
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
