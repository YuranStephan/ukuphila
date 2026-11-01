import type { Metadata } from "next";
import Link from "next/link";
import { Rings, WovenRings } from "@/components/brand";
import { Icon } from "@/components/icon";
import { DeckNav } from "@/components/site/deck-nav";
import { VoiceDemo } from "@/components/site/voice-demo";
import { ExampleTag } from "@/components/ui";
import { FACTS, MICROCREDIT_NOTE, SANDBOX_NOTE, SOURCES } from "@/lib/market-facts";
import { formatMT } from "@/lib/money";
import { programmeKpis } from "@/server/analytics/programme";
import { getDb } from "@/server/db/client";
import { readinessItems } from "@/server/db/schema";
import { isDemo } from "@/server/env";

export const metadata: Metadata = { title: "Apresentação", description: "Porque é que o Ukuphila existe, como funciona e o que falta provar." };

const SOURCE_LINE = "Banco de Moçambique, Relatório de Inclusão Financeira 2025";

function Foot({ n, note }: { n: number; note?: string }) {
  return (
    <div className="slide-foot">
      <span>{note ?? "Ukuphila · Crescer. Conectar. Prosperar."}</span>
      <span className="num">{n}</span>
    </div>
  );
}

export default async function PitchPage() {
  const db = await getDb();
  const [kpis, readiness] = await Promise.all([programmeKpis(db), db.select().from(readinessItems).orderBy(readinessItems.position)]);
  const validated = readiness.filter((item) => item.status === "validado").length;
  const demo = isDemo();
  return (
    <main className="deck" id="deck">
      <section className="slide" data-surface="noite">
        <WovenRings className="hero-rings" />
        <div style={{ position: "relative", maxWidth: 680 }}>
          <p className="kicker">Ukuphila · Apresentação</p>
          <h1 className="hero-title">
            <span>Ajudar primeiro.</span>
            <span className="hero-accent">Pedir depois.</span>
          </h1>
          <p className="say">A infra-estrutura de confiança do comércio informal de Moçambique.</p>
        </div>
        <Foot n={1} />
      </section>

      <section className="slide" data-surface="cal">
        <p className="kicker">O problema</p>
        <h2>Quem vende no mercado conhece cada cliente. Ninguém conhece os seus números.</h2>
        <div className="deck-grid">
          <div className="deck-card">
            <h3>Perdas silenciosas</h3>
            <p>Dinheiro da banca misturado com o da casa. Stock sem registo. Fiado de memória.</p>
          </div>
          <div className="deck-card">
            <h3>Invisibilidade</h3>
            <p>Anos de trabalho sério que não aparecem em lado nenhum. Sem historial, sem crédito.</p>
          </div>
          <div className="deck-card">
            <h3>Produtos que não encaixam</h3>
            <p>Documentos actualizados, morada formal, prestações rígidas. Um negócio sazonal não cabe ali.</p>
          </div>
        </div>
        <p className="say">O problema não é capacidade empresarial. É acesso.</p>
        <Foot n={2} />
      </section>

      <section className="slide" data-surface="noite">
        <p className="kicker">A tese</p>
        <h2>Moçambique já resolveu o pagamento. Falta a memória.</h2>
        <div className="deck-grid">
          {[FACTS.walletAccounts, FACTS.bankAccounts, FACTS.creditGdp].map((fact) => (
            <div key={fact.unit} className="deck-card">
              <strong className="big num">{fact.value}</strong>
              <p>{fact.unit}</p>
            </div>
          ))}
        </div>
        <p className="say">O dinheiro já corre no telemóvel, mas sem contexto. Quem guardar a memória do negócio guarda a chave do crédito.</p>
        <Foot n={3} note={`Fonte: ${SOURCE_LINE}, dados de 2025.`} />
      </section>

      <section className="slide" data-surface="cal">
        <p className="kicker">A solução</p>
        <h2>Quatro anéis, por esta ordem.</h2>
        <div className="deck-grid" style={{ ["--cols" as string]: 4 }}>
          {[
            ["Caixa", "Ver o negócio"],
            ["Poupança", "Separar e guardar"],
            ["Xitique", "Confiança colectiva"],
            ["Crédito", "Consequência, não entrada"],
          ].map(([name, body], index) => (
            <div key={name} className="deck-card">
              <Rings ring={index + 1} size={110} />
              <h3>{name}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
        <p className="say">Cada anel é útil por si, e cada um produz os dados que tornam o seguinte possível.</p>
        <Foot n={4} />
      </section>

      <section className="slide" data-surface="noite">
        <p className="kicker">O produto, ao vivo</p>
        <h2>Fala como falas na banca.</h2>
        <div className="split" style={{ marginTop: 24 }}>
          <div>
            <p className="say">Escreva uma frase. O mesmo intérprete do produto está a correr aqui, sem rede.</p>
            <p className="say">Voz, app e WhatsApp usam o mesmo motor. A IA nunca toca num saldo: propõe, a pessoa confirma, o ledger regista.</p>
          </div>
          <VoiceDemo />
        </div>
        <Foot n={5} />
      </section>

      <section className="slide" data-surface="cal">
        <p className="kicker">Uma plataforma, cinco mundos</p>
        <h2>Tudo construído e a funcionar.</h2>
        <div className="deck-grid">
          {[
            ["Comerciante", "App offline com voz, bolsos, stock, fiado, Xitique, crédito e passaporte.", "/app"],
            ["Agente", "Ronda do dia, registo assistido, KYC, incidentes e ganhos.", "/agente"],
            ["Gestão", "KPIs do piloto, operação, IA, base de conhecimento e prontidão.", "/gestao"],
            ["Sala de risco", "Exposição, PAR, concentração, alertas, casos e governação.", "/risco"],
            ["Fornecedor", "Pedidos, entregas por código e liquidações.", "/fornecedor"],
            ["WhatsApp", "O mesmo motor de conversa, com simulador e webhook prontos.", "/gestao/ia"],
          ].map(([title, body, href]) => (
            <Link key={title} className="deck-card" href={demo ? "/demo" : href}>
              <h3>{title}</h3>
              <p>{body}</p>
            </Link>
          ))}
        </div>
        <Foot n={6} />
      </section>

      <section className="slide" data-surface="noite">
        <p className="kicker">O que é difícil de copiar</p>
        <h2>A confiança está no sistema, não na promessa.</h2>
        <div className="deck-grid" style={{ ["--cols" as string]: 2 }}>
          {[
            ["Ledger imutável", "Dupla entrada imposta pela base de dados. Correcções por estorno. Cadeia de hashes verificável."],
            ["Offline que se prova", "Cada telefone assina e encadeia os registos. Manipulação local é detectada sem perder vendas reais."],
            ["Quem viu os meus dados", "Cada acesso fica visível para o próprio comerciante."],
            ["Passaporte do negócio", "O historial é da pessoa. Partilha selectiva, assinada e com prazo."],
          ].map(([title, body]) => (
            <div key={title} className="deck-card">
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
        <Foot n={7} />
      </section>

      <section className="slide" data-surface="cal">
        <p className="kicker">Cenário de demonstração</p>
        <h2>Como se lê um piloto por dentro.</h2>
        <div className="deck-grid" style={{ ["--cols" as string]: 4 }}>
          <div className="deck-card">
            <strong className="big num">{kpis.merchants}</strong>
            <p>comerciantes no cenário</p>
          </div>
          <div className="deck-card">
            <strong className="big num">{kpis.wau}</strong>
            <p>activos na semana</p>
          </div>
          <div className="deck-card">
            <strong className="big num">{kpis.xitiqueGroups}</strong>
            <p>grupos de Xitique activos</p>
          </div>
          <div className="deck-card">
            <strong className="big num" style={{ fontSize: "clamp(1.4rem,3vw,2.2rem)" }}>
              {formatMT(kpis.salesRecorded30)}
            </strong>
            <p>registados em 30 dias</p>
          </div>
        </div>
        <p className="say">Estes números são gerados por dados sintéticos para mostrar os painéis. Não são tracção real: o piloto ainda não começou.</p>
        <Foot n={8} note="Dados sintéticos de demonstração." />
      </section>

      <section className="slide" data-surface="noite">
        <p className="kicker">Modelo de negócio</p>
        <h2>Receita que não depende de endividar pessoas.</h2>
        <div className="deck-grid" style={{ ["--cols" as string]: 4 }}>
          {[
            ["Transacções", "Receita ligada ao uso, à medida que parceiros de pagamento entram."],
            ["Leasing", "Acesso ao telefone em prestações, distribuído pelos agentes."],
            ["Fornecedores", "Economia ligada à cadeia de abastecimento."],
            ["Crédito", "Vem depois, como consequência da relação."],
          ].map(([title, body]) => (
            <div key={title} className="deck-card">
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
        <p className="say">
          <ExampleTag>Preços e percentagens por definir no piloto</ExampleTag>
        </p>
        <Foot n={9} />
      </section>

      <section className="slide" data-surface="cal">
        <p className="kicker">Regulação</p>
        <h2>Um caminho por etapas, sem atalhos.</h2>
        <ol className="ladder">
          <li>
            <strong>Hoje</strong>Registo e gestão. Não guarda dinheiro.
          </li>
          <li>
            <strong>Piloto</strong>Parceiro licenciado e, se fizer sentido, Sandbox do Banco de Moçambique.
          </li>
          <li>
            <strong>Crédito</strong>Enquadramento próprio, por exemplo como operador de microcrédito registado.
          </li>
          <li>
            <strong>Visão</strong>Instituição com licença própria, se o caminho funcionar.
          </li>
        </ol>
        <p className="say" style={{ fontSize: "0.98rem" }}>
          {SANDBOX_NOTE} {MICROCREDIT_NOTE}
        </p>
        <Foot n={10} note={`Fonte: ${SOURCES.bm2025.label}. Enquadramento do Ukuphila por validar com jurista e regulador.`} />
      </section>

      <section className="slide" data-surface="noite">
        <p className="kicker">Honestidade</p>
        <h2>O que está provado, e o que falta provar.</h2>
        <div className="deck-grid" style={{ ["--cols" as string]: 2 }}>
          <div className="deck-card">
            <h3>Pronto</h3>
            <p>Produto completo, com ledger, offline, Xitique, KYC, crédito, risco, agente e IA com limites, tudo testado.</p>
          </div>
          <div className="deck-card">
            <h3>Por validar: {readiness.length - validated} de {readiness.length} critérios</h3>
            <p>Parceiro licenciado, KYC, preços, política de crédito, línguas locais e, acima de tudo, se os comerciantes usam isto todos os dias.</p>
          </div>
        </div>
        <p className="say">O objectivo do piloto não é provar que a tecnologia funciona. É provar que o modelo funciona para pessoas reais, num mercado real.</p>
        <Foot n={11} />
      </section>

      <section className="slide" data-surface="cal">
        <p className="kicker">O que pedimos</p>
        <h2>Um mercado. Um parceiro licenciado. Um fornecedor.</h2>
        <div className="deck-grid">
          <div className="deck-card">
            <h3>Piloto em Xipamanine</h3>
            <p>Número controlado de comerciantes, dez perguntas e critérios claros de sucesso e de falha.</p>
          </div>
          <div className="deck-card">
            <h3>Quem queremos à mesa</h3>
            <p>Instituição licenciada, carteira móvel, distribuidor de confiança e financiador paciente.</p>
          </div>
          <div className="deck-card">
            <h3>Próximo passo</h3>
            <p>Conversa de 30 minutos e visita à demonstração.</p>
          </div>
        </div>
        <div className="row wrap" style={{ marginTop: 26 }}>
          <Link className="btn btn-primary" href="/contacto">
            Falar connosco <Icon name="arrowRight" size={18} />
          </Link>
          {demo ? (
            <Link className="btn btn-ghost" href="/demo">
              Entrar na demonstração
            </Link>
          ) : null}
        </div>
        <Foot n={12} />
      </section>
      <DeckNav />
    </main>
  );
}
