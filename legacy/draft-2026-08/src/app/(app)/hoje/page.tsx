"use client";

import { Money } from "@/components/Money";
import { PocketBag } from "@/components/PocketBag";
import { ICONS, Product, Tx, UserMe, api, type Pocket } from "@/lib/client";
import { primeiroNome, saudacaoHora } from "@/lib/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function HojePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(null);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [inv, setInv] = useState<Product[]>([]);
  const [tab, setTab] = useState<"negocio" | "casa">("negocio");
  const [pulse, setPulse] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const me = await api<UserMe>("/api/users/me");
        setUser(me);
        const [p, t, i] = await Promise.all([
          api<Pocket[]>("/api/pockets"),
          api<Tx[]>("/api/transactions?periodo=hoje"),
          api<Product[]>("/api/inventory"),
        ]);
        setPockets(p);
        setTxs(t);
        setInv(i);
        setPulse(true);
      } catch (e) {
        const status = (e as Error & { status?: number }).status;
        if (status === 401) {
          if (!localStorage.getItem("ukuphila-onboarded")) router.replace("/onboarding");
          else router.replace("/entrar");
        } else setErro("Não conseguimos abrir isto agora. Tenta outra vez quando tiveres rede.");
      }
    })();
  }, [router]);

  const pocket = pockets.find((p) => p.tipo === tab);
  const total = pockets.reduce((s, p) => s + p.saldoAtual, 0);
  const hoje = useMemo(() => {
    const vendeste = txs.filter((t) => t.tipo === "venda").reduce((s, t) => s + t.valor, 0);
    const gastaste = txs.filter((t) => t.tipo === "compra").reduce((s, t) => s + t.valor, 0);
    return { vendeste, gastaste, lucro: vendeste - gastaste };
  }, [txs]);
  const baixo = inv.filter((i) => i.quantidadeAtual <= i.limiarStockBaixo);
  const dias = user?.diasComTransacoes ?? 0;
  const falta = Math.max(0, 14 - dias);

  if (erro) return <p>{erro}</p>;
  if (!user) return <p>A abrir o teu dia…</p>;

  return (
    <div>
      <p style={{ margin: "0 0 4px", color: "var(--cinza-suave)" }}>{saudacaoHora()}</p>
      <h1 className="display" style={{ fontSize: "1.85rem" }}>
        {primeiroNome(user.nome)}
      </h1>
      <div className="capulana-line" style={{ margin: "16px 0 20px" }} />

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "0.9rem", color: "var(--cinza-suave)" }}>Tudo junto</div>
        <div className={`saldo-grande ${pulse ? "pulse-marigold" : ""}`}>
          <Money value={total} />
        </div>
        <div className="tabs" style={{ marginTop: 14 }}>
          <button className={tab === "negocio" ? "on" : ""} onClick={() => setTab("negocio")}>
            Negócio
          </button>
          <button className={tab === "casa" ? "on" : ""} onClick={() => setTab("casa")}>
            Casa
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          <PocketBag tipo={tab} saldo={pocket?.saldoAtual ?? 0} compact />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <strong>Hoje</strong>
        <p style={{ margin: "8px 0 0" }}>
          Vendeste <Money value={hoje.vendeste} /> · gastaste <Money value={hoje.gastaste} />
        </p>
        <p className={hoje.lucro >= 0 ? "lucro" : "prejuizo"} style={{ fontWeight: 700, margin: "6px 0 0" }}>
          {hoje.lucro >= 0 ? "Ficou" : "Saiu"} <Money value={Math.abs(hoje.lucro)} />
        </p>
      </div>

      {baixo[0] ? (
        <div className="card warn" style={{ marginBottom: 14 }}>
          <strong>
            O {baixo[0].nomeProduto.toLowerCase()} está a acabar — restam {baixo[0].quantidadeAtual}
          </strong>
          <p style={{ margin: "8px 0 0" }}>
            <Link href={`/registar?tipo=compra&produto=${baixo[0].id}`} className="btn btn-ghost" style={{ minHeight: 44 }}>
              Registar compra
            </Link>
          </p>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong>Movimentos de hoje</strong>
          <Link href="/bolsos" style={{ color: "var(--verde-vida)", fontWeight: 700, textDecoration: "none" }}>
            Ver tudo
          </Link>
        </div>
        {txs.slice(0, 5).map((t) => (
          <div className="list-row" key={t.id}>
            <div className="icon-blob">{ICONS[t.produto?.icone || "caixa"] || "🧺"}</div>
            <div style={{ flex: 1 }}>
              <div>{t.nota || t.produto?.nomeProduto || (t.tipo === "venda" ? "Venda" : "Compra")}</div>
              <small style={{ color: "var(--cinza-suave)" }}>{t.tipo === "venda" ? "Vendi" : "Comprei"}</small>
            </div>
            <Money className={t.tipo === "venda" ? "lucro" : "prejuizo"} value={t.tipo === "venda" ? t.valor : -t.valor} />
          </div>
        ))}
        {!txs.length ? <p style={{ color: "var(--cinza-suave)" }}>Ainda não registaste nada hoje.</p> : null}
      </div>

      <div className="card soft" style={{ marginBottom: 18 }}>
        <strong>
          {falta === 0
            ? "Já podes abrir um xitique"
            : `Estás a ${falta} dias de desbloquear o Xitique`}
        </strong>
        <div className="progress" style={{ marginTop: 12 }}>
          <span style={{ width: `${Math.min(100, (dias / 14) * 100)}%` }} />
        </div>
        <p style={{ fontSize: "0.9rem", color: "var(--cinza-suave)", margin: "8px 0 0" }}>
          O crédito de fornecedor vem mais tarde — primeiro a caixa.
        </p>
      </div>

      <Link href="/registar" className="btn btn-primary">
        Registar venda ou compra
      </Link>
    </div>
  );
}
