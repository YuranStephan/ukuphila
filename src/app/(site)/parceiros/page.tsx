import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/site/lead-form";
import { PageHero } from "@/components/site/page-hero";
import { FACTS, MICROCREDIT_NOTE, SANDBOX_NOTE, SOURCES } from "@/lib/market-facts";

export const metadata: Metadata = { title: "Parceiros" };

const PARTNERS = [
  ["Carteiras móveis", "Não concorremos com a M-Pesa, a e-Mola nem o mKesh. O registo do Ukuphila dá contexto de negócio a quem já usa carteira."],
  ["Instituições licenciadas", "Procuramos um parceiro para custódia, poupança e financiamento no piloto. Nada disto avança sem base regulatória."],
  ["Fornecedores e distribuidores", "O primeiro produto de crédito nasce na cadeia de abastecimento, com compras reais e entregas confirmadas."],
  ["Organizações de desenvolvimento", "Dados agregados, com critérios de privacidade, sobre o que funciona para comerciantes informais."],
];

export default function PartnersPage() {
  return (
    <>
      <PageHero eyebrow="Parceiros" title="Construímos a camada que falta, sem substituir quem já funciona." lead={`${FACTS.walletAccounts.value} ${FACTS.walletAccounts.unit} em 2025. O acesso ao pagamento existe. Falta a memória que transforma actividade em confiança.`} />
      <section className="section">
        <div className="container stack" style={{ ["--gap" as string]: "30px" }}>
          <div className="content-grid two">
            {PARTNERS.map(([title, body]) => (
              <article key={title} className="content-card">
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <div className="split" style={{ alignItems: "start" }}>
            <div className="stack">
              <h2 className="section-heading" style={{ fontSize: "clamp(1.7rem,3.6vw,2.6rem)" }}>
                Um caminho regulatório por etapas.
              </h2>
              <p className="muted">{SANDBOX_NOTE}</p>
              <p className="muted">{MICROCREDIT_NOTE}</p>
              <p className="tiny muted">
                Fonte: <a href={SOURCES.bm2025.url}>{SOURCES.bm2025.label}</a>. O enquadramento do Ukuphila ainda tem de ser validado com o regulador e com aconselhamento jurídico.
              </p>
              <Link className="link" href="/pitch">
                Ver a apresentação completa
              </Link>
            </div>
            <div className="card">
              <h3 className="card-title">Falar connosco</h3>
              <LeadForm kind="parceiro" fields={["organisation", "email"]} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
