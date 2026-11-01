import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { enterAsPersonaAction } from "@/actions/auth";
import { Logo } from "@/components/brand";
import { isDemo } from "@/server/env";

export const metadata: Metadata = { title: "Demonstração" };

const GROUPS = [
  {
    title: "No mercado",
    personas: [
      { key: "celeste", role: "Comerciante · Anel 4", name: "Celeste Machava", about: "Nove meses de registos em Xipamanine. Poupa, é pontual no Xitique e já liquidou uma compra a crédito." },
      { key: "armando", role: "Comerciante · a crescer", name: "Armando Cossa", about: "Mercearia em Zimpeto com quatro meses de historial e um pedido de crédito em análise." },
      { key: "rosa", role: "Comerciante · novo", name: "Rosa Nhantumbo", about: "Começou há nove dias. Vê o que falta, um documento rejeitado e o primeiro Xitique." },
      { key: "agente", role: "Agente · Xipamanine", name: "Nélia Sitoe", about: "A ronda do dia, registo de comerciantes, KYC, incidentes e ganhos, no telefone." },
      { key: "fornecedor", role: "Fornecedor", name: "Frescos da Matola", about: "Pedidos aprovados, entregas confirmadas pelo código do comerciante e liquidações." },
    ],
  },
  {
    title: "Na operação",
    personas: [
      { key: "gestao", role: "Gestão", name: "Equipa de Gestão", about: "KPIs do piloto, comerciantes, agentes, dispositivos, IA, base de conhecimento e prontidão." },
      { key: "revisao", role: "Revisão KYC", name: "Fila de documentos", about: "Rever documentos cifrados. Quem submete nunca pode aprovar." },
      { key: "analise", role: "Análise de crédito", name: "Primeiro par de olhos", about: "Ler sinais explicados e recomendar ou recusar com motivo." },
      { key: "aprovacao", role: "Aprovação de crédito", name: "Segundo par de olhos", about: "Aprovar ou recusar o que a análise recomendou." },
      { key: "risco", role: "Sala de risco", name: "Risco", about: "Exposição, atrasos, concentração, alertas, casos e governação dos sinais." },
      { key: "auditoria", role: "Auditoria", name: "Só leitura", about: "Lê tudo, não altera nada, e prova a cadeia de auditoria." },
    ],
  },
] as const;

export default function DemoPage() {
  if (!isDemo()) notFound();
  return (
    <main className="section" style={{ minHeight: "100dvh" }}>
      <div className="container stack" style={{ ["--gap" as string]: "26px" }}>
        <Link href="/" aria-label="Ukuphila, página inicial">
          <Logo />
        </Link>
        <div>
          <p className="eyebrow">Demonstração</p>
          <h1 className="section-heading">Entra na pele de quem usa.</h1>
          <p className="section-lead">Todas as pessoas, empresas e valores aqui são sintéticos. Podes experimentar à vontade: é um ambiente de demonstração, não uma operação real. Os limites, prazos e custos de crédito são exemplos, por validar.</p>
        </div>
        {GROUPS.map((group) => (
          <section key={group.title} className="stack">
            <h2 className="card-title">{group.title}</h2>
            <div className="demo-grid">
              {group.personas.map((persona) => (
                <form key={persona.key} action={enterAsPersonaAction.bind(null, persona.key)}>
                  <button className="persona" type="submit" data-persona={persona.key}>
                    <span className="persona-role">{persona.role}</span>
                    <h3>{persona.name}</h3>
                    <p>{persona.about}</p>
                  </button>
                </form>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
