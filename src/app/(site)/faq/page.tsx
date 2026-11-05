import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";

export const metadata: Metadata = { title: "Perguntas frequentes" };

const FAQ = [
  ["O que é o Ukuphila?", "É um acompanhante de negócio criado para ajudar comerciantes informais a organizar o negócio e construir uma relação financeira gradual."],
  ["Preciso de crédito para começar?", "Não. Começas pela gestão do negócio, pela poupança e pela construção de historial. O crédito só aparece muito mais tarde, se fizer sentido."],
  ["Como são calculados os meus saldos?", "Os saldos resultam dos movimentos da tua conta. Podes consultar o historial e acompanhar o negócio, a casa e a poupança em bolsos separados."],
  ["O que é o Xitique digital?", "É o registo do teu grupo de poupança: quem pagou, quem recebe e o que mudou. O grupo continua a ser vosso."],
  ["Por que existe um agente?", "Porque a confiança e a ajuda de uma pessoa fazem parte do modelo. Há coisas que uma aplicação não resolve."],
  ["Funciona sem internet?", "Sim, para o dia-a-dia: vendas, despesas, stock, fiado e poupança. Algumas coisas exigem rede, como aceitar um contrato ou submeter um documento."],
  ["A IA pode aprovar o meu crédito?", "Não. A IA não promete nem decide. A análise e a aprovação são feitas por pessoas, seguindo uma política formal."],
  ["Quem pode ver os meus dados?", "O teu agente e a equipa que precisa deles para o serviço. Cada acesso fica registado e tu podes ver a lista na aplicação."],
  ["Posso partilhar o meu historial?", "Sim. Tu geras um passaporte com o que quiseres mostrar, com prazo, e podes cancelá-lo quando quiseres."],
];

export default function FaqPage() {
  return (
    <>
      <PageHero eyebrow="Perguntas frequentes" title="O que as pessoas perguntam primeiro." lead="Se a tua pergunta não estiver aqui, fala com o agente no teu mercado." />
      <section className="section">
        <div className="container-narrow faq">
          {FAQ.map(([question, answer], index) => (
            <details key={question} open={index === 0}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
