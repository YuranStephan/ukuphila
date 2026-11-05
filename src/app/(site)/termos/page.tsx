import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos" };

export default function TermsPage() {
  return (
    <section className="section">
      <div className="container-narrow stack" style={{ ["--gap" as string]: "16px" }}>
        <p className="eyebrow">Termos</p>
        <h1 className="section-heading">Condições de utilização</h1>
        <div className="notice">Versão 1.0, Novembro de 2026. Antes de qualquer alteração importante, avisamos na aplicação.</div>
        <div className="prose">
          <h2>O que o Ukuphila é</h2>
          <p>Um serviço para acompanhar o teu negócio, organizar movimentos e construir o teu historial. Os saldos são calculados a partir dos movimentos da tua conta.</p>
          <h2>Serviços financeiros</h2>
          <p>Cada serviço financeiro tem condições próprias, apresentadas antes de aceitares. A disponibilização de poupança, crédito e pagamentos depende da configuração do serviço e dos parceiros responsáveis.</p>
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
