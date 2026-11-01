"use client";

import { Money } from "@/components/Money";
import { PocketBag } from "@/components/PocketBag";
import { ICONS, Product, Tx, api, enqueue, type Pocket } from "@/lib/client";
import { useEffect, useState } from "react";

export default function BolsosPage() {
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [inv, setInv] = useState<Product[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [periodo, setPeriodo] = useState("hoje");
  const [aberto, setAberto] = useState<"negocio" | "casa">("negocio");
  const [stockAberto, setStockAberto] = useState(true);
  const [produto, setProduto] = useState<Product | null>(null);
  const [hist, setHist] = useState<Tx[]>([]);
  const [mover, setMover] = useState(false);
  const [valorMove, setValorMove] = useState("");
  const [de, setDe] = useState<"negocio" | "casa">("negocio");
  const [msg, setMsg] = useState("");

  async function load(p = periodo) {
    const [po, i, t] = await Promise.all([
      api<Pocket[]>("/api/pockets"),
      api<Product[]>("/api/inventory"),
      api<Tx[]>(`/api/transactions?periodo=${p}`),
    ]);
    setPockets(po);
    setInv(i);
    setTxs(t);
  }

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api<Tx[]>(`/api/transactions?periodo=${periodo}`).then(setTxs).catch(() => {});
  }, [periodo]);

  const negocio = pockets.find((p) => p.tipo === "negocio");
  const casa = pockets.find((p) => p.tipo === "casa");
  const pocketId = aberto === "negocio" ? negocio?.id : casa?.id;
  const list = txs.filter((t) => t.pocketId === pocketId);

  async function confirmarMover() {
    const valor = Number(valorMove);
    if (!valor) return;
    const para = de === "negocio" ? "casa" : "negocio";
    const uuid = crypto.randomUUID();
    const payload = { de, para, valor, client_uuid: uuid };
    try {
      if (navigator.onLine) await api("/api/pockets/transfer", { method: "POST", body: JSON.stringify(payload) });
      else enqueue({ tipo: "transferencia", payload, client_uuid: uuid, timestamp: new Date().toISOString() });
      setMsg("O dinheiro passou de bolso.");
      setMover(false);
      setValorMove("");
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function abrirProduto(p: Product) {
    setProduto(p);
    const h = await api<Tx[]>(`/api/transactions?produto=${p.id}&periodo=mes`);
    setHist(h);
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: "1.8rem" }}>
        Bolsos
      </h1>
      <p style={{ color: "var(--cinza-suave)" }}>O dinheiro do negócio e o da casa, cada um no seu sítio.</p>
      <div className="capulana-line" style={{ margin: "12px 0 18px" }} />

      <div style={{ display: "grid", gap: 12 }}>
        <button
          onClick={() => setAberto("negocio")}
          style={{ border: 0, background: "none", padding: 0, textAlign: "left" }}
        >
          <PocketBag tipo="negocio" saldo={negocio?.saldoAtual ?? 0} />
        </button>
        <button onClick={() => setAberto("casa")} style={{ border: 0, background: "none", padding: 0, textAlign: "left" }}>
          <PocketBag tipo="casa" saldo={casa?.saldoAtual ?? 0} />
        </button>
      </div>

      <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => setMover(true)}>
        Mover dinheiro entre bolsos
      </button>

      {mover ? (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Tens a certeza?</strong>
          <p>Isto tira de um bolso e mete no outro. Não dá para desfazer sozinho.</p>
          <div className="tabs" style={{ margin: "12px 0" }}>
            <button className={de === "negocio" ? "on" : ""} onClick={() => setDe("negocio")}>
              Negócio → Casa
            </button>
            <button className={de === "casa" ? "on" : ""} onClick={() => setDe("casa")}>
              Casa → Negócio
            </button>
          </div>
          <input
            inputMode="numeric"
            value={valorMove}
            onChange={(e) => setValorMove(e.target.value.replace(/\D/g, ""))}
            placeholder="Valor em MT"
            style={{
              width: "100%",
              minHeight: 52,
              borderRadius: 14,
              border: "1px solid rgba(35,31,26,0.15)",
              padding: "0 14px",
              background: "var(--areia)",
            }}
          />
          <div className="btn-split" style={{ marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => setMover(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={confirmarMover}>
              Mover agora
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 22 }}>
        <strong>Movimentos — {aberto === "negocio" ? "Negócio" : "Casa"}</strong>
        <div className="chip-row" style={{ margin: "10px 0" }}>
          {["hoje", "semana", "mes"].map((p) => (
            <button key={p} className={`chip ${periodo === p ? "on" : ""}`} onClick={() => setPeriodo(p)}>
              {p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
        {list.map((t) => (
          <div className="list-row" key={t.id}>
            <div className="icon-blob">{ICONS[t.produto?.icone || "caixa"] || "🧺"}</div>
            <div style={{ flex: 1 }}>
              {t.nota || t.produto?.nomeProduto || (t.tipo === "venda" ? "Venda" : "Compra")}
              {t.precisaRevisao ? (
                <div style={{ color: "var(--coral-alerta)", fontSize: "0.8rem" }}>Para rever</div>
              ) : null}
            </div>
            <Money value={t.tipo === "venda" ? t.valor : -t.valor} className={t.tipo === "venda" ? "lucro" : "prejuizo"} />
          </div>
        ))}
        {!list.length ? <p style={{ color: "var(--cinza-suave)" }}>Ainda não há movimentos neste tempo.</p> : null}
      </div>

      {aberto === "negocio" ? (
        <div className="card" style={{ marginTop: 20 }}>
          <button
            onClick={() => setStockAberto((v) => !v)}
            style={{
              width: "100%",
              border: 0,
              background: "none",
              textAlign: "left",
              fontWeight: 700,
              minHeight: 44,
            }}
          >
            O que tenho para vender {stockAberto ? "▴" : "▾"}
          </button>
          {stockAberto
            ? inv.map((p) => (
                <button
                  key={p.id}
                  className="list-row"
                  onClick={() => abrirProduto(p)}
                  style={{ width: "100%", background: "none", border: 0, textAlign: "left" }}
                >
                  <div className="icon-blob">{ICONS[p.icone] || "🧺"}</div>
                  <div style={{ flex: 1 }}>
                    {p.nomeProduto}
                    <div style={{ fontSize: "0.85rem", color: "var(--cinza-suave)" }}>
                      Restam {p.quantidadeAtual}
                    </div>
                  </div>
                  <span className={`dot ${p.quantidadeAtual <= p.limiarStockBaixo ? "low" : "ok"}`} />
                </button>
              ))
            : null}
        </div>
      ) : null}

      {produto ? (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>{produto.nomeProduto}</strong>
          <p style={{ color: "var(--cinza-suave)" }}>Restam {produto.quantidadeAtual}</p>
          {hist.map((t) => (
            <div className="list-row" key={t.id}>
              <div>{t.tipo === "venda" ? "Vendi" : "Comprei"}</div>
              <Money value={t.valor} />
            </div>
          ))}
          <button className="btn btn-ghost" onClick={() => setProduto(null)}>
            Fechar
          </button>
        </div>
      ) : null}

      {msg ? <div className="toast">{msg}</div> : null}
    </div>
  );
}
