import type { Metadata } from "next";
import { LeadForm } from "@/components/site/lead-form";
import { PageHero } from "@/components/site/page-hero";

export const metadata: Metadata = { title: "Contacto" };

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contacto" title="Vamos conversar." lead="Comerciantes, agentes, fornecedores, parceiros financeiros e investidores." />
      <section className="section">
        <div className="container-narrow">
          <div className="card">
            <LeadForm kind="investidor" fields={["organisation", "email", "market"]} cta="Enviar mensagem" />
          </div>
        </div>
      </section>
    </>
  );
}
