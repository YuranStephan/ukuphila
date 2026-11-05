import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidade" };

export default function PrivacyPage() {
  return (
    <section className="section">
      <div className="container-narrow stack" style={{ ["--gap" as string]: "16px" }}>
        <p className="eyebrow">Privacidade</p>
        <h1 className="section-heading">Como tratamos os teus dados</h1>
        <div className="notice">Versão 1.0, Novembro de 2026. Segue a Lei n.º 3/2017, de Transacções Electrónicas. Antes de qualquer alteração importante, avisamos na aplicação.</div>
        <div className="prose">
          <h2>O que recolhemos</h2>
          <p>O mínimo necessário: número de telefone, o nome pelo qual te conhecem, mercado, actividade e os registos que fizeres. Documentos só quando forem precisos, e só com o teu conhecimento.</p>
          <h2>Para quê</h2>
          <p>Cada dado tem uma finalidade: mostrar-te o teu negócio, verificar a tua identidade e, se pedires, avaliar crédito. Cada consentimento fica registado com a versão, a data e o canal, e os opcionais podem ser retirados a qualquer momento.</p>
          <h2>Quem vê</h2>
          <p>O teu agente vê a tua carteira de apoio. A equipa de revisão vê os documentos que submetes. Cada acesso fica registado e aparece em “Quem viu os meus dados”, na aplicação.</p>
          <h2>Inteligência artificial</h2>
          <p>Quando autorizas o assistente, o texto pode ser enviado a um fornecedor de IA para interpretar o que disseste. Saldos e dados de terceiros não são enviados com esse objectivo. Sem autorização, o Ukuphila usa só o intérprete que corre no próprio sistema.</p>
          <h2>Partilha</h2>
          <p>Não vendemos dados. Só partilhas o teu historial por iniciativa tua, através de um passaporte com prazo. Os números agregados nunca mostram um grupo com menos de cinco pessoas.</p>
          <h2>Conservação</h2>
          <p>[Prazo a definir com a política de retenção aprovada.] Movimentos financeiros e registos de auditoria não se apagam durante o período legal aplicável.</p>
        </div>
      </div>
    </section>
  );
}
