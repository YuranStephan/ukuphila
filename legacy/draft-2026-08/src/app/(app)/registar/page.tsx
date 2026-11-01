"use client";

import { PocketBag } from "@/components/PocketBag";
import { ICONS, Product, api, enqueue, type Pocket } from "@/lib/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function RegistarInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [tipo, setTipo] = useState<"venda" | "compra">((params.get("tipo") as "compra") || "venda");
  const [valor, setValor] = useState("");
  const [bolso, setBolso] = useState<"negocio" | "casa">("negocio");
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [inv, setInv] = useState<Product[]>([]);
  const [produtoId, setProdutoId] = useState(params.get("produto") || "");
  const [qty, setQty] = useState(1);
  const [novoNome, setNovoNome] = useState("");
  const [listening, setListening] = useState(false);
  const [metodo, setMetodo] = useState<"texto" | "voz">("texto");
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    Promise.all([api<Pocket[]>("/api/pockets"), api<Product[]>("/api/inventory")]).then(([p, i]) => {
      setPockets(p);
      setInv(i);
    });
  }, []);

  const produto = inv.find((i) => i.id === produtoId);

  function tecla(k: string) {
    if (k === "⌫") setValor((v) => v.slice(0, -1));
    else if (k === "00") setValor((v) => (v ? v + "00" : v));
    else setValor((v) => (v === "0" ? k : v + k).slice(0, 8));
  }

  function ouvir() {
    setListening(true);
    setMetodo("voz");
    setTimeout(() => {
      setListening(false);
      setValor("250");
      setTipo("venda");
      setBolso("negocio");
    }, 1800);
  }

  async function guardar() {
    const n = Number(valor);
    if (!n) {
      setErro("Diz o valor.");
      return;
    }
    const pocket = pockets.find((p) => p.tipo === bolso);
    const uuid = crypto.randomUUID();
    let pid = produtoId;
    try {
      if (tipo === "compra" && novoNome.trim()) {
        const created = await api<Product>("/api/inventory", {
          method: "POST",
          body: JSON.stringify({
            nome_produto: novoNome.trim(),
            quantidade_inicial: qty,
            limiar_stock_baixo: 5,
          }),
        });
        pid = created.id;
      }
      const payload = {
        pocket_id: pocket?.id,
        tipo,
        valor: n,
        produto_id: pid || undefined,
        metodo_registo: metodo,
        quantidade: tipo === "compra" ? qty : undefined,
        client_uuid: uuid,
      };
      if (navigator.onLine) {
        await api("/api/transactions", { method: "POST", body: JSON.stringify(payload) });
      } else {
        enqueue({ tipo: "transacao", payload, client_uuid: uuid, timestamp: new Date().toISOString() });
      }
      setOk(true);
      setTimeout(() => router.push("/hoje"), 900);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: "1.8rem" }}>
        {tipo === "venda" ? "Registar venda" : "Registar compra"}
      </h1>
      <div className="btn-split" style={{ margin: "16px 0" }}>
        <button className={`btn-choice ${tipo === "venda" ? "on" : ""}`} onClick={() => setTipo("venda")}>
          Vendi
        </button>
        <button className={`btn-choice ${tipo === "compra" ? "on" : ""}`} onClick={() => setTipo("compra")}>
          Comprei
        </button>
      </div>

      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ color: "var(--cinza-suave)" }}>Valor</div>
        <div className="saldo-grande">{valor ? `${Number(valor).toLocaleString("pt-PT")} MT` : "0 MT"}</div>
      </div>
      <div className="num-pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"].map((k) => (
          <button key={k} onClick={() => tecla(k)}>
            {k}
          </button>
        ))}
      </div>

      <p style={{ fontWeight: 700, marginTop: 18 }}>Qual bolso?</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button
          onClick={() => setBolso("negocio")}
          style={{ border: bolso === "negocio" ? "3px solid var(--verde-vida)" : "3px solid transparent", borderRadius: 22, padding: 0 }}
        >
          <PocketBag tipo="negocio" saldo={pockets.find((p) => p.tipo === "negocio")?.saldoAtual ?? 0} compact />
        </button>
        <button
          onClick={() => setBolso("casa")}
          style={{ border: bolso === "casa" ? "3px solid var(--verde-vida)" : "3px solid transparent", borderRadius: 22, padding: 0 }}
        >
          <PocketBag tipo="casa" saldo={pockets.find((p) => p.tipo === "casa")?.saldoAtual ?? 0} compact />
        </button>
      </div>

      <button className={`mic ${listening ? "listening" : ""}`} style={{ marginTop: 16 }} onClick={ouvir}>
        {listening ? "A ouvir…" : "Ou fala comigo"}
      </button>

      <p style={{ fontWeight: 700, marginTop: 18 }}>O quê? (se quiseres)</p>
      <div className="chip-row">
        {inv.map((p) => (
          <button key={p.id} className={`chip ${produtoId === p.id ? "on" : ""}`} onClick={() => setProdutoId(p.id)}>
            {ICONS[p.icone] || "🧺"} {p.nomeProduto}
          </button>
        ))}
      </div>
      {produto ? (
        <p style={{ color: "var(--cinza-suave)", fontSize: "0.92rem" }}>
          {produto.nomeProduto} — restam {produto.quantidadeAtual}
        </p>
      ) : null}

      {tipo === "compra" ? (
        <div className="card" style={{ marginTop: 12 }}>
          {produto ? (
            <>
              <p>Queres acrescentar quantidade? (não é obrigatório)</p>
              <div className="stepper">
                <button onClick={() => setQty((q) => Math.max(0, q - 1))}>−</button>
                <strong className="tabular">{qty}</strong>
                <button onClick={() => setQty((q) => q + 1)}>+</button>
              </div>
            </>
          ) : (
            <>
              <p>O que comprei</p>
              <input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nome do produto"
                style={{
                  width: "100%",
                  minHeight: 48,
                  borderRadius: 12,
                  border: "1px solid rgba(35,31,26,0.15)",
                  padding: "0 12px",
                  background: "var(--areia)",
                }}
              />
              <div className="stepper" style={{ marginTop: 10 }}>
                <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <strong className="tabular">{qty}</strong>
                <button onClick={() => setQty((q) => q + 1)}>+</button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {erro ? <p className="prejuizo">{erro}</p> : null}
      <button className={`btn btn-primary ${ok ? "saved-check" : ""}`} style={{ marginTop: 18 }} onClick={guardar}>
        {ok ? "Guardado" : "Guardar"}
      </button>
    </div>
  );
}

export default function RegistarPage() {
  return (
    <Suspense fallback={<p>A abrir…</p>}>
      <RegistarInner />
    </Suspense>
  );
}
