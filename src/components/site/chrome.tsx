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

export function SiteHeader() {
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
          <Link className="btn btn-sun btn-s" href="/registar">
            Criar conta
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
          <span>Crescer. Conectar. Prosperar.</span>
          <a className="footer-credit" href="https://www.linkedin.com/in/yuranstefan/" target="_blank" rel="noopener noreferrer" aria-label="Desenvolvido por Yuran Magodine (abre o LinkedIn)">
            <svg className="footer-credit-icon" width="23" height="23" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.224 24 24 23.227 24 22.271V1.729C24 .774 23.224 0 22.222 0h.003z" /></svg>
            <span className="footer-credit-copy"><span>Desenvolvido por</span><strong>Yuran Magodine</strong></span>
            <Icon name="arrowRight" size={15} className="footer-credit-arrow" />
          </a>
        </div>
      </div>
    </footer>
  );
}
