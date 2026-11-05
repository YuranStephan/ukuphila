import type { Metadata } from "next";
import { LeadForm } from "@/components/site/lead-form";
import { AgentMarketPhoto } from "@/components/site/agent-market-photo";

export const metadata: Metadata = { title: "Agentes e quiosques" };

const ROLE = [
  ["Conhecer o mercado", "Quem vive no mercado é quem melhor o explica. O agente traz esse conhecimento para dentro do produto."],
  ["Registar e ensinar", "Abre contas com consentimento, ensina o primeiro registo e fica por perto nas primeiras semanas."],
  ["Apoiar a verificação", "Confirma o que vê e distingue-o do que lhe dizem. Nunca aprova os documentos que submete."],
  ["Resolver", "Ajuda com documentos, dispositivos, registos por rever e pedidos que a IA não sabe resolver."],
];

const CONTROLS = ["Identidade própria para cada agente.", "Só vê a sua carteira de comerciantes.", "Cada acesso fica visível para o próprio comerciante.", "Registos feitos pelo agente ficam identificados como tal."];

export default function AgentsPage() {
  return (
    <>
      <section className="agent-page-hero" data-surface="noite">
        <div className="container agent-page-hero-grid">
          <div className="agent-page-hero-copy">
            <p className="eyebrow">Agentes e quiosques</p>
            <h1>A tecnologia não entra sozinha no mercado.</h1>
            <p className="section-lead">Uma pessoa de confiança, perto de ti. O agente faz a ponte entre o Ukuphila e a vida do mercado: ensina, acompanha e ajuda a dar o próximo passo.</p>
          </div>
          <AgentMarketPhoto preload />
        </div>
      </section>
      <section className="section">
        <div className="container stack" style={{ ["--gap" as string]: "30px" }}>
          <div className="content-grid two">
            {ROLE.map(([title, body]) => (
              <article key={title} className="content-card">
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <div className="split">
            <div>
              <h2 className="section-heading" style={{ fontSize: "clamp(1.7rem,3.6vw,2.6rem)" }}>
                Confiança também com quem ajuda.
              </h2>
              <ul className="tick-list">
                {CONTROLS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3 className="card-title">Quero ser agente</h3>
              <LeadForm kind="agente" fields={["market"]} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
