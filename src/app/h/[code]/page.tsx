import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { Logo } from "@/components/brand";
import { Icon } from "@/components/icon";
import { formatDay } from "@/lib/dates";
import { getDb } from "@/server/db/client";
import { appUrl } from "@/server/env";
import { verifyPassport } from "@/server/passport";

export const metadata: Metadata = { title: "Passaporte do negócio", robots: { index: false } };

type Snapshot = {
  identidade?: { name: string; market: string; activity: string };
  verificacao?: { level: number };
  actividade?: { months: number; activeDays90: number };
  volume?: { band: string };
  poupanca?: { months6: number };
  xitique?: { due: number; onTime: number };
  credito?: { due: number; onTime: number; settled: number; overdue: number };
};

const STATES = {
  expirado: "Este passaporte expirou.",
  revogado: "O comerciante cancelou este passaporte.",
  adulterado: "Este passaporte não passou na verificação da assinatura.",
};

export default async function PassportPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const view = await verifyPassport(await getDb(), decodeURIComponent(code));
  const qr = await QRCode.toString(`${appUrl()}/h/${code}`, { type: "svg", margin: 0, color: { dark: "#071f1a", light: "#fffefa" } });
  const snapshot = (view?.snapshot ?? {}) as Snapshot;
  const rows: [string, string][] = [];
  if (snapshot.verificacao) rows.push(["Verificação", `Nível ${snapshot.verificacao.level}`]);
  if (snapshot.actividade) rows.push(["Historial", `${snapshot.actividade.months} meses de registos, ${snapshot.actividade.activeDays90} dias activos nos últimos 90`]);
  if (snapshot.volume) rows.push(["Vendas registadas", snapshot.volume.band]);
  if (snapshot.poupanca) rows.push(["Poupança", `Em ${snapshot.poupanca.months6} dos últimos 6 meses`]);
  if (snapshot.xitique) rows.push(["Xitique", snapshot.xitique.due ? `${snapshot.xitique.onTime} de ${snapshot.xitique.due} contribuições a tempo` : "Sem participação registada"]);
  if (snapshot.credito) rows.push(["Fornecedores", `${snapshot.credito.settled} compras liquidadas, ${snapshot.credito.onTime} de ${snapshot.credito.due} prestações a tempo${snapshot.credito.overdue ? `, ${snapshot.credito.overdue} em atraso` : ""}`]);

  return (
    <main className="section" style={{ minHeight: "100dvh" }}>
      <div className="container-narrow stack" style={{ ["--gap" as string]: "18px" }}>
        <Link href="/" aria-label="Ukuphila">
          <Logo />
        </Link>
        {!view ? (
          <div className="card">
            <h1 className="card-title">Passaporte não encontrado</h1>
            <p className="muted">Confirma o código com a pessoa que o partilhou.</p>
          </div>
        ) : view.state !== "valido" ? (
          <div className="card">
            <h1 className="card-title">Sem dados para mostrar</h1>
            <p className="muted">{STATES[view.state]}</p>
          </div>
        ) : (
          <article className="card stack" style={{ ["--gap" as string]: "14px" }}>
            <div className="row-between wrap">
              <div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>
                  Passaporte do negócio
                </p>
                <h1 style={{ fontSize: "1.9rem" }}>{snapshot.identidade?.name ?? "Comerciante"}</h1>
                {snapshot.identidade ? (
                  <p className="muted">
                    {snapshot.identidade.activity} · Mercado de {snapshot.identidade.market}
                  </p>
                ) : null}
              </div>
              <span className="passport-state">
                <Icon name="check" size={14} /> Assinatura válida
              </span>
            </div>
            <dl className="passport-rows">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="row" style={{ ["--gap" as string]: "16px" }}>
              <div style={{ width: 92, flex: "none" }} dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="tiny muted">
                Preparado para {view.audience}. Emitido em {view.createdAt ? formatDay(view.createdAt) : "—"}, válido até {view.expiresAt ? formatDay(view.expiresAt) : "—"}. O comerciante escolheu o que aparece aqui e pode cancelar a qualquer momento. Isto é um registo de actividade, não uma garantia de crédito.
              </p>
            </div>
          </article>
        )}
      </div>
    </main>
  );
}
