import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { PageHero } from "@/components/site/page-hero";

export const metadata: Metadata = { title: "Para comerciantes" };

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: "mic", title: "Fala e fica registado", body: "“Vendi duas caixas por mil.” O Ukuphila prepara o registo e tu confirmas." },
  { icon: "wallet", title: "Bolsos separados", body: "Negócio, Casa, Poupança e Xitique. Sabes sempre de que dinheiro estás a falar." },
  { icon: "box", title: "Stock que avisa", body: "Vê o que está a acabar antes de perderes a venda." },
  { icon: "users", title: "Caderno do fiado", body: "Quem te deve, quanto e há quanto tempo. Sem discussões." },
  { icon: "chart", title: "Lucro estimado", body: "Facturação não é lucro. Vê o que sobrou depois de pagar o stock e as despesas." },
  { icon: "chat", title: "WhatsApp também", body: "Pergunta “quanto tenho?” ou reencaminha o SMS da carteira móvel." },
  { icon: "wifiOff", title: "Sem internet", body: "Regista à vontade. Quando houver rede, sincroniza sozinho." },
  { icon: "qr", title: "Passaporte do negócio", body: "Mostra o teu historial a quem quiseres, quando quiseres, pelo tempo que quiseres." },
  { icon: "hand", title: "Um agente teu", body: "Uma pessoa no mercado para ajudar quando a aplicação não chega." },
];

export default function MerchantsPage() {
  return (
    <>
      <PageHero eyebrow="Para comerciantes" title="Tu sabes vender. Nós ajudamos a guardar a memória." lead="Conheces os teus clientes pelo nome e o preço do tomate de cor. O Ukuphila guarda o resto, para saberes quanto ganhaste de verdade." />
      <section className="section">
        <div className="container stack" style={{ ["--gap" as string]: "28px" }}>
          <div className="content-grid">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="content-card">
                <Icon name={feature.icon} size={24} />
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
          <div>
            <Link className="btn btn-primary" href="/registar">
              Criar conta <Icon name="arrowRight" size={18} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
