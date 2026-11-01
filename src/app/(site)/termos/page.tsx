import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos" };

export default function TermsPage() {
  return (
    <section className="section">
      <div className="container-narrow stack" style={{ ["--gap" as string]: "16px" }}>
        <p className="eyebrow">Termos</p>
        <h1 className="section-heading">Condições de utilização</h1>
        <div className="notice">Rascunho para demonstração. A entidade jurídica, os produtos financeiros e estas condições têm de ser definidos e revistos antes de qualquer operação real.</div>
        <div className="prose">
          <h2>O que o Ukuphila é</h2>
          <p>Um serviço de registo e gestão do negócio. Os saldos mostrados são o que registaste, não dinheiro guardado pelo Ukuphila.</p>
          <h2>O que não é</h2>
          <p>Não é um banco nem uma carteira de moeda electrónica. Poupança, crédito e pagamentos reais dependem de parceiros licenciados, ainda por definir.</p>
          <h2>Crédito</h2>
          <p>O crédito não é um direito automático. As decisões são tomadas por pessoas, segundo uma política aprovada, e as condições aparecem por escrito antes de aceitares.</p>
          <h2>Responsabilidades</h2>
          <p>Registas com verdade e proteges o teu PIN e o teu telefone. Nós guardamos os teus registos com cuidado e dizemos-te quem os viu.</p>
          <h2>Contactos</h2>
          <p>[Entidade responsável, morada e NUIT a definir.]</p>
        </div>
      </div>
    </section>
  );
}
