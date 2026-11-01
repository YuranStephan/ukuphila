"use client";

import { Money } from "@/components/Money";
import { api } from "@/lib/client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Group = {
  id: string;
  nome: string;
  n_membros: number;
  valorContribuicao: number;
  proxima_data: string | null;
  codigoConvite: string;
};

export default function XitiquePage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [criar, setCriar] = useState(false);
  const [entrar, setEntrar] = useState(false);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("500");
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      setGroups(await api<Group[]>("/api/xitique/groups"));
    } catch {
      setGroups([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function criarGrupo() {
    try {
      await api("/api/xitique/groups", {
        method: "POST",
        body: JSON.stringify({ nome, valor_contribuicao: Number(valor), periodicidade: "semanal" }),
      });
      setCriar(false);
      setMsg("Grupo criado.");
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function entrarGrupo() {
    try {
      await api("/api/xitique/join", { method: "POST", body: JSON.stringify({ codigo }) });
      setEntrar(false);
      setMsg("Entraste no grupo.");
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  if (!groups) return <p>A abrir os teus grupos…</p>;

  return (
    <div>
      <h1 className="display" style={{ fontSize: "1.8rem" }}>
        Xitique
      </h1>
      <p style={{ color: "var(--cinza-suave)" }}>Poupar juntas, à vez, como já fazem no mercado.</p>
      <div className="capulana-line" style={{ margin: "12px 0 18px" }} />

      {!groups.length ? (
        <div className="empty card">
          <div style={{ fontSize: "3rem" }}>🪢</div>
          <h2 className="display" style={{ fontSize: "1.4rem", marginTop: 8 }}>
            Ainda não estás em nenhum grupo
          </h2>
          <p>
            No xitique, cada uma mete o mesmo valor, à mesma hora. Quando chegar a tua vez, recebes o bolo.
            Digital, mas com a mesma confiança de sempre.
          </p>
        </div>
      ) : (
        groups.map((g) => (
          <Link key={g.id} href={`/xitique/${g.id}`} className="card" style={{ display: "block", marginBottom: 12, textDecoration: "none" }}>
            <strong>{g.nome}</strong>
            <p style={{ margin: "6px 0 0", color: "var(--cinza-suave)" }}>
              {g.n_membros} pessoas · <Money value={g.valorContribuicao} /> cada vez
            </p>
            {g.proxima_data ? (
              <p style={{ margin: "4px 0 0" }}>
                Próxima: {new Date(g.proxima_data).toLocaleDateString("pt-MZ")}
              </p>
            ) : null}
          </Link>
        ))
      )}

      <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setCriar(true)}>
        Criar novo grupo
      </button>
      <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setEntrar(true)}>
        Entrar num grupo existente
      </button>

      {criar ? (
        <div className="card" style={{ marginTop: 14 }}>
          <input
            placeholder="Nome do grupo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            style={field}
          />
          <input
            placeholder="Valor de cada vez"
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
            style={{ ...field, marginTop: 8 }}
          />
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={criarGrupo}>
            Criar grupo
          </button>
          <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => setCriar(false)}>
            Cancelar
          </button>
        </div>
      ) : null}

      {entrar ? (
        <div className="card" style={{ marginTop: 14 }}>
          <p>Pede o código à pessoa que criou o grupo.</p>
          <input placeholder="Ex: ZIMP-441" value={codigo} onChange={(e) => setCodigo(e.target.value)} style={field} />
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={entrarGrupo}>
            Entrar
          </button>
          <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => setEntrar(false)}>
            Cancelar
          </button>
        </div>
      ) : null}
      {msg ? <div className="toast">{msg}</div> : null}
    </div>
  );
}

const field: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 12,
  border: "1px solid rgba(35,31,26,0.15)",
  padding: "0 12px",
  background: "var(--areia)",
};
