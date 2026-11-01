import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { PageHero } from "@/components/site/page-hero";

export const metadata: Metadata = { title: "Como funciona" };

const JOURNEY = [
  ["Conhecer", "Um agente apresenta o Ukuphila na tua banca, sem pressa e sem compromisso."],
  ["Registar", "Número de telefone, o nome pelo qual te conhecem, o mercado e o que vendes. Sem filas."],
  ["Verificar", "Primeiro o telefone e o rosto. Outros documentos vêm depois, se fizerem falta."],
  ["Registar o dia", "Falas ou tocas: vendas, compras, despesas. Em segundos, mesmo sem rede."],
  ["Separar", "Passas dinheiro do bolso do Negócio para a Casa e para a Poupança."],
  ["Poupar", "Metas com nome, como as propinas da escola, e o progresso à vista."],
  ["Xitique", "O teu grupo com registo comum, confirmado por duas pessoas."],
  ["Historial", "Cada dia regista-se como prova do teu trabalho. E esse historial é teu."],
  ["Crédito fornecedor", "Stock para pagar depois das vendas, quando houver historial e uma pessoa aprovar."],
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero eyebrow="Como funciona" title="Da primeira venda registada ao primeiro crédito." lead="Uma relação que cresce devagar, com um agente ao lado. Cada passo é útil por si, mesmo que nunca chegues ao seguinte." />
      <section className="section">
        <div className="container-narrow">
          <ol className="timeline">
            {JOURNEY.map(([title, body], index) => (
              <li key={title}>
                <span className="n num">{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p className="muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="row wrap" style={{ marginTop: 28 }}>
            <Link className="btn btn-primary" href="/comerciantes">
              Para comerciantes <Icon name="arrowRight" size={18} />
            </Link>
            <Link className="btn btn-ghost" href="/faq">
              Perguntas frequentes
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
