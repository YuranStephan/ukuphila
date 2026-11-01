import Link from "next/link";
import { Logo } from "@/components/brand";
import { Icon } from "@/components/icon";

const NAV = [
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/comerciantes", label: "Comerciantes" },
  { href: "/agentes", label: "Agentes" },
  { href: "/fornecedores", label: "Fornecedores" },
  { href: "/parceiros", label: "Parceiros" },
  { href: "/seguranca", label: "Confiança" },
];

export function SiteHeader({ demo }: { demo: boolean }) {
  return (
    <header className="site-header no-print">
      <div className="container site-header-row">
        <Link href="/" aria-label="Ukuphila, página inicial">
          <Logo tone="light" />
        </Link>
        <nav className="site-nav" aria-label="Principal">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="site-header-actions">
          <Link className="site-enter" href="/entrar">
            Entrar
          </Link>
          <Link className="btn btn-sun btn-s" href={demo ? "/demo" : "/contacto"}>
            {demo ? "Ver demonstração" : "Falar connosco"}
          </Link>
        </div>
        <details className="site-burger">
          <summary aria-label="Abrir menu">
            <Icon name="chevron" size={22} />
          </summary>
          <nav aria-label="Menu móvel">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <Link href="/sobre">Sobre</Link>
            <Link href="/faq">Perguntas frequentes</Link>
            <Link href="/entrar">Entrar</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer no-print" data-surface="noite">
      <div className="container">
        <div className="footer-grid">
          <div className="stack" style={{ ["--gap" as string]: "14px" }}>
            <Logo tone="light" />
            <p className="footer-tag">Crescer. Conectar. Prosperar.</p>
            <p className="small muted">Um acompanhante de negócio para quem vende nos mercados de Maputo.</p>
          </div>
          <nav aria-label="Produto">
            <h3>Produto</h3>
            <Link href="/como-funciona">Como funciona</Link>
            <Link href="/comerciantes">Para comerciantes</Link>
            <Link href="/agentes">Agentes e quiosques</Link>
            <Link href="/fornecedores">Fornecedores</Link>
            <Link href="/verificar">Verificar um passaporte</Link>
          </nav>
          <nav aria-label="Organização">
            <h3>Organização</h3>
            <Link href="/sobre">Sobre</Link>
            <Link href="/parceiros">Parceiros</Link>
            <Link href="/pitch">Apresentação</Link>
            <Link href="/seguranca">Confiança e segurança</Link>
            <Link href="/faq">Perguntas frequentes</Link>
          </nav>
          <nav aria-label="Legal">
            <h3>Legal</h3>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/termos">Termos</Link>
            <Link href="/contacto">Contacto</Link>
          </nav>
        </div>
        <div className="footer-base">
          <span>O Ukuphila regista o teu negócio. Não guarda o teu dinheiro.</span>
          <a className="footer-credit" href="https://www.linkedin.com/in/yuranstefan/" target="_blank" rel="noreferrer" aria-label="Desenvolvido por Yuran Magodine (abre o LinkedIn)">
            Desenvolvido por Yuran Magodine
          </a>
        </div>
      </div>
    </footer>
  );
}
