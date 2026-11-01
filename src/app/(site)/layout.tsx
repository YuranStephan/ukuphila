import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { isDemo } from "@/server/env";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const demo = isDemo();
  return (
    <>
      {demo ? (
        <p className="demo-bar no-print">
          Ambiente de demonstração com dados sintéticos. <Link href="/demo">Entrar como comerciante, agente ou gestão</Link>
        </p>
      ) : null}
      <SiteHeader demo={demo} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
