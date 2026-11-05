import type { Metadata } from "next";
import { LeadForm } from "@/components/site/lead-form";
import { PageHero } from "@/components/site/page-hero";

export const metadata: Metadata = { title: "Fornecedores" };

const FLOW = [
  ["O comerciante pede", "Escolhe produtos do teu catálogo. O pedido só existe se o historial o permitir."],
  ["Duas pessoas decidem", "A análise recomenda e outra pessoa aprova. Tu não assumes essa decisão."],
  ["Entregas com código", "Quando entregas, pedes o código ao comerciante. Sem código, não começa nenhuma dívida."],
  ["Acompanhas as liquidações", "Vês o que está pago, o que falta e o que está em atraso."],
];

export default function SuppliersPage() {
  return (
    <>
      <PageHero eyebrow="Fornecedores" title="Vende a quem tem historial, não só a quem tem dinheiro na mão." lead="O crédito fornecedor liga o financiamento à actividade real do comerciante: stock, vendas e pagamento depois." />
      <section className="section">
        <div className="container split" style={{ alignItems: "start" }}>
          <div className="stack" style={{ ["--gap" as string]: "14px" }}>
            <ol className="timeline" style={{ marginTop: 0 }}>
              {FLOW.map(([title, body], index) => (
                <li key={title}>
                  <span className="n num">{index + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p className="muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="card">
            <h3 className="card-title">Quero conversar</h3>
            <LeadForm kind="fornecedor" fields={["organisation", "email"]} />
          </div>
        </div>
      </section>
    </>
  );
}
