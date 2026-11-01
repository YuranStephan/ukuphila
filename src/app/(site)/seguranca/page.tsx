import type { Metadata } from "next";
import { Icon, type IconName } from "@/components/icon";
import { PageHero } from "@/components/site/page-hero";

export const metadata: Metadata = { title: "Confiança e segurança" };

const BLOCKS: { icon: IconName; title: string; items: string[] }[] = [
  {
    icon: "lock",
    title: "Registo que não se apaga",
    items: ["Dupla entrada: cada movimento tem de balancear, e a base de dados recusa o que não balanceia.", "Movimentos e auditoria só crescem. Um erro corrige-se com outro registo.", "Cada movimento liga-se ao anterior por uma impressão digital, por isso uma alteração escondida é detectada."],
  },
  {
    icon: "phone",
    title: "Telefone que assina",
    items: ["Cada dispositivo cria uma chave que não sai do telefone.", "Registos offline são numerados, encadeados e assinados.", "Telefone perdido: sessão terminada, aparelho bloqueado, cópia local apagada ao voltar à rede."],
  },
  {
    icon: "users",
    title: "Decisões com duas pessoas",
    items: ["Quem submete um documento não o pode aprovar.", "Quem recomenda crédito não o pode aprovar.", "Uma contribuição do Xitique é declarada por uma pessoa e confirmada por outra."],
  },
  {
    icon: "eye",
    title: "Os dados pertencem à pessoa",
    items: ["“Quem viu os meus dados” mostra cada acesso de agentes e equipa.", "O consentimento tem finalidade, data e versão, e pode ser retirado.", "O passaporte partilha só o que a pessoa escolhe, com prazo."],
  },
  {
    icon: "document",
    title: "Documentos cifrados",
    items: ["Cifrados antes de serem guardados.", "Abrir um documento deixa registo.", "Rejeição tem sempre motivo, e o histórico permanece."],
  },
  {
    icon: "chat",
    title: "IA com limites",
    items: ["Interpreta e propõe. Nunca executa sem confirmação.", "Saldos e estados vêm do sistema, nunca do modelo.", "Só responde com conhecimento aprovado, e passa para uma pessoa o que não sabe."],
  },
];

export default function TrustPage() {
  return (
    <>
      <PageHero eyebrow="Confiança e segurança" title="Confiança não se pede. Mostra-se." lead="Pessoas que nunca foram servidas pelo sistema financeiro têm razões para desconfiar. Por isso estas garantias estão no próprio sistema, onde podem ser verificadas." />
      <section className="section">
        <div className="container stack" style={{ ["--gap" as string]: "22px" }}>
          <div className="content-grid">
            {BLOCKS.map((block) => (
              <article key={block.title} className="content-card">
                <Icon name={block.icon} size={24} />
                <h3>{block.title}</h3>
                <ul className="tick-list" style={{ marginTop: 6, fontSize: "0.94rem" }}>
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="notice">Estado actual: estas garantias estão implementadas e testadas no produto. Ainda falta revisão independente de segurança e validação regulatória antes de uma operação real.</div>
        </div>
      </section>
    </>
  );
}
