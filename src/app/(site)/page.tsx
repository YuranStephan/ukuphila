import Link from "next/link";
import { LogoMark, Rings, WovenRings, XitiqueCircle } from "@/components/brand";
import { Icon, type IconName } from "@/components/icon";
import { VoiceDemo } from "@/components/site/voice-demo";
import { FACTS, SOURCES } from "@/lib/market-facts";
import { isDemo } from "@/server/env";

const STEPS: { ring: number; name: string; verb: string; body: string; points: string[] }[] = [
  { ring: 1, name: "Caixa", verb: "Ver", body: "Vendas, compras, despesas e fiado em linguagem de banca. Falas, confirmas, fica registado.", points: ["Quanto vendi hoje", "Quanto me devem", "O que está a acabar"] },
  { ring: 2, name: "Poupança", verb: "Separar", body: "Bolsos para o negócio, a casa e o futuro. O dinheiro da banca deixa de se misturar com o da família.", points: ["Bolsos separados", "Metas com nome", "Progresso visível"] },
  { ring: 3, name: "Xitique", verb: "Conectar", body: "O grupo de sempre, agora com memória comum. Cada pagamento é confirmado por duas pessoas.", points: ["Ordem combinada ou sorteada", "Histórico visível a todos", "Membros sem telefone incluídos"] },
  { ring: 4, name: "Crédito", verb: "Prosperar", body: "Stock do fornecedor para pagar depois das vendas. Só quando há historial, e sempre com uma pessoa a decidir.", points: ["Motivos explicados", "Duas pessoas a aprovar", "O teu PIN é a tua assinatura"] },
];

const TRUST: { icon: IconName; title: string; body: string }[] = [
  { icon: "eye", title: "Quem viu os meus dados", body: "Cada vez que um agente ou revisor abre o teu perfil, fica uma linha que tu podes ler." },
  { icon: "lock", title: "Nada se apaga", body: "O registo só cresce. Um erro corrige-se com outro registo, e os dois ficam visíveis." },
  { icon: "wifiOff", title: "Sem rede, sem problema", body: "O telefone guarda e assina cada registo. Quando a rede volta, sincroniza sozinho." },
  { icon: "users", title: "Sempre há uma pessoa", body: "A IA interpreta e sugere. Dinheiro, documentos e crédito são decididos por gente." },
];

export default function HomePage() {
  const demo = isDemo();
  return (
    <>
      <section className="hero" data-surface="noite">
        <WovenRings className="hero-rings" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="hero-eyebrow rise">Para quem vende nos mercados de Maputo</p>
            <h1 className="hero-title">
              <span className="rise" style={{ animationDelay: "60ms" }}>
                Ajudar primeiro.
              </span>
              <span className="rise hero-accent" style={{ animationDelay: "160ms" }}>
                Pedir depois.
              </span>
            </h1>
            <p className="hero-lead rise" style={{ animationDelay: "260ms" }}>
              O Ukuphila dá a cada comerciante a memória do seu negócio: caixa, stock, fiado, poupança e Xitique, com um agente de confiança na banca ao lado. O crédito vem depois, como consequência.
            </p>
            <div className="hero-actions rise" style={{ animationDelay: "340ms" }}>
              <Link className="btn btn-sun" href={demo ? "/demo" : "/contacto"}>
                {demo ? "Ver a demonstração" : "Falar connosco"} <Icon name="arrowRight" size={18} />
              </Link>
              <Link className="btn btn-ghost" href="/pitch">
                Ver a apresentação
              </Link>
            </div>
            <ul className="hero-points rise" style={{ animationDelay: "420ms" }}>
              <li>
                <Icon name="mic" size={16} /> Fala e fica registado
              </li>
              <li>
                <Icon name="wifiOff" size={16} /> Funciona sem internet
              </li>
              <li>
                <Icon name="hand" size={16} /> Agente no teu mercado
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section thesis">
        <div className="container">
          <p className="eyebrow">A tese</p>
          <h2 className="section-heading wide">
            Moçambique já resolveu o pagamento. <em>Falta a memória.</em>
          </h2>
          <div className="thesis-grid">
            <div className="thesis-stat">
              <strong className="num">{FACTS.walletAccounts.value}</strong>
              <span>{FACTS.walletAccounts.unit}</span>
            </div>
            <div className="thesis-stat">
              <strong className="num">{FACTS.bankAccounts.value}</strong>
              <span>{FACTS.bankAccounts.unit}</span>
            </div>
            <div className="thesis-stat" data-tone="caju">
              <strong className="num">{FACTS.creditGdp.value}</strong>
              <span>{FACTS.creditGdp.unit}</span>
            </div>
          </div>
          <div className="thesis-text">
            <p>
              O dinheiro já circula pelo telemóvel. Mas quem vende no mercado continua sem saber quanto ganhou no mês, e nenhum fornecedor ou banco consegue ver anos de trabalho sério. A capacidade existe. O registo não.
            </p>
            <p className="tiny muted">
              Fonte: <a href={SOURCES.bm2025.url}>{SOURCES.bm2025.label}</a>, dados de 2025.
            </p>
          </div>
        </div>
      </section>

      <section className="section rings-section" data-surface="noite">
        <div className="container">
          <p className="eyebrow">O caminho</p>
          <h2 className="section-heading">Quatro anéis, por esta ordem.</h2>
          <p className="section-lead">Como os anéis de uma árvore: cada um cresce à volta do anterior. Ninguém salta para o crédito. Chega-se lá com historial próprio.</p>
          <ol className="steps">
            {STEPS.map((step) => (
              <li key={step.ring} className="step">
                <Rings ring={step.ring} size={92} tone="night" />
                <span className="step-verb">{step.verb}</span>
                <h3>{step.name}</h3>
                <p>{step.body}</p>
                <ul>
                  {step.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div>
            <p className="eyebrow">Experimenta agora</p>
            <h2 className="section-heading">Fala como falas na banca.</h2>
            <p className="section-lead">
              Sem menus nem contabilidade. Diz o que aconteceu e o Ukuphila prepara o registo para tu confirmares. Este intérprete está a correr no teu navegador, sem internet, tal como no telefone do comerciante.
            </p>
            <p className="small muted">Escreve na caixa ao lado. Experimenta números por extenso, como “mil e quinhentos”.</p>
          </div>
          <VoiceDemo />
        </div>
      </section>

      <section className="section triad-section">
        <div className="container">
          <p className="eyebrow">Porque funciona aqui</p>
          <h2 className="section-heading">Três peças que outros tentam vender separadas.</h2>
          <div className="triad">
            <article>
              <Icon name="phone" size={26} />
              <h3>Um telefone acessível</h3>
              <p>Leasing para quem ainda não tem um bom aparelho. Câmara para documentos, microfone para a voz, e bateria para o dia de mercado.</p>
            </article>
            <article>
              <Icon name="hand" size={26} />
              <h3>Um agente de confiança</h3>
              <p>Uma pessoa com rosto, no quiosque do mercado. Ensina, ajuda a registar, trata de documentos e explica o que a aplicação não consegue.</p>
            </article>
            <article>
              <Icon name="ring" size={26} />
              <h3>Uma plataforma que aguenta</h3>
              <p>Registo imutável, offline a sério, WhatsApp para quem prefere conversar, e painéis para quem gere o risco.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section xitique-section" data-surface="noite">
        <div className="container split reverse">
          <div className="xitique-visual">
            <XitiqueCircle
              size={320}
              recipient={2}
              members={[
                { name: "Celeste Machava", state: "confirmada" },
                { name: "Lurdes Sitoe", state: "confirmada" },
                { name: "Teresa Bila", state: "confirmada" },
                { name: "Júlia Tembe", state: "declarada" },
                { name: "Marta Langa", state: "confirmada" },
                { name: "Zita Nhaca", state: "pendente" },
                { name: "Rute Novela", state: "confirmada" },
                { name: "Filomena Cossa", state: "declarada" },
              ]}
            />
          </div>
          <div>
            <p className="eyebrow">Xitique digital</p>
            <h2 className="section-heading">Não inventámos o Xitique. Demos-lhe memória.</h2>
            <p className="section-lead">O dinheiro continua a circular como sempre. O Ukuphila guarda o que antes dependia da memória de cada uma: quem pagou, quem recebe, e o que mudou.</p>
            <ul className="tick-list">
              <li>Quem paga declara, outra pessoa confirma.</li>
              <li>Sorteio que qualquer membro pode conferir.</li>
              <li>Quem não tem telefone continua no grupo.</li>
              <li>A pontualidade passa a contar para o teu historial.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div>
            <p className="eyebrow">Passaporte do negócio</p>
            <h2 className="section-heading">O teu historial é teu.</h2>
            <p className="section-lead">Com um toque, geras um passaporte com o que quiseres mostrar a um fornecedor ou a um banco. Tu escolhes o que entra e por quanto tempo vale. Os saldos exactos e os documentos nunca saem.</p>
            <Link className="link" href="/verificar">
              Como se verifica um passaporte
            </Link>
          </div>
          <div className="passport-card">
            <div className="row-between">
              <LogoMark size={30} />
              <span className="passport-state">
                <Icon name="check" size={14} /> Válido
              </span>
            </div>
            <h3>Passaporte do negócio</h3>
            <dl>
              <div>
                <dt>Historial</dt>
                <dd>9 meses de registos</dd>
              </div>
              <div>
                <dt>Vendas</dt>
                <dd>30 a 75 mil MT por mês</dd>
              </div>
              <div>
                <dt>Xitique</dt>
                <dd>24 de 24 a tempo</dd>
              </div>
              <div>
                <dt>Fornecedores</dt>
                <dd>1 compra liquidada</dd>
              </div>
            </dl>
            <p className="tiny muted">Exemplo ilustrativo. Código verificável por QR e assinado pelo Ukuphila.</p>
          </div>
        </div>
      </section>

      <section className="section trust-section">
        <div className="container">
          <p className="eyebrow">Confiança, por construção</p>
          <h2 className="section-heading">Promessas que estão no código.</h2>
          <div className="trust-grid">
            {TRUST.map((item) => (
              <article key={item.title}>
                <Icon name={item.icon} size={24} />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
          <Link className="btn btn-ghost" href="/seguranca">
            Ver como protegemos os dados <Icon name="arrowRight" size={18} />
          </Link>
        </div>
      </section>

      <section className="cta-band" data-surface="noite">
        <div className="container cta-row">
          <div>
            <h2>O piloto começa num só mercado.</h2>
            <p>Profundidade antes de largura. Se és comerciante, agente, fornecedor ou parceiro financeiro, fala connosco.</p>
          </div>
          <Link className="btn btn-sun" href="/contacto">
            Quero fazer parte <Icon name="arrowRight" size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
