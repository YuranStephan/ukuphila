import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";

export const metadata: Metadata = { title: "Sobre" };

const PRINCIPLES = [
  ["Ajudar primeiro, pedir depois", "O produto tem de ser útil antes de pedir seja o que for."],
  ["Começar pelo negócio, não pela dívida", "O crédito é consequência de uma relação."],
  ["Preservar práticas locais", "O Xitique e o fiado já funcionam. Damos-lhes memória."],
  ["A tecnologia não pode ser o gargalo", "Voz, WhatsApp, telefones modestos e ausência de rede são o ponto de partida."],
  ["Profundidade antes de largura", "Validar um mercado antes de pensar em dois."],
  ["Subprometer e superar", "Dizer o que é hipótese e o que está provado."],
];

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="Sobre" title="Uma ponte entre quem já sabe fazer negócio e quem nunca olhou para eles." lead="O problema do comércio informal não é falta de capacidade empresarial. É falta de acesso: a ferramentas, a historial e a produtos desenhados para esta realidade." />
      <section className="section">
        <div className="container stack" style={{ ["--gap" as string]: "24px" }}>
          <h2 className="section-heading">Os nossos princípios</h2>
          <div className="content-grid">
            {PRINCIPLES.map(([title, body]) => (
              <article key={title} className="content-card">
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <div className="prose" style={{ maxWidth: "64ch" }}>
            <h2>Para onde vamos</h2>
            <p>O caminho começa num piloto pequeno, num único mercado de Maputo, e só se alarga com evidência. A longo prazo, a visão é uma instituição de microfinança com licença própria, se o caminho anterior funcionar e os factores regulatórios o permitirem. É uma visão estratégica, não uma garantia.</p>
          </div>
        </div>
      </section>
    </>
  );
}
