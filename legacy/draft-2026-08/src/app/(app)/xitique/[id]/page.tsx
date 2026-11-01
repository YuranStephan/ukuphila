"use client";

import { Money } from "@/components/Money";
import { api } from "@/lib/client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Detail = {
  id: string;
  nome: string;
  valorContribuicao: number;
  codigoConvite: string;
  total_acumulado: number;
  members: { id: string; nome: string; userId: string }[];
  contributions: {
    id: string;
    userId: string;
    valor: number;
    dataPrevista: string;
    dataPago: string | null;
    estado: string;
  }[];
};

export default function XitiqueDetail() {
  const { id } = useParams<{ id: string }>();
  const [g, setG] = useState<Detail | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    setG(await api<Detail>(`/api/xitique/groups/${id}`));
  }
  useEffect(() => {
    load().catch(() => {});
  }, [id]);

  async function pagar() {
    try {
      await api(`/api/xitique/groups/${id}/contributions`, {
        method: "POST",
        body: JSON.stringify({ valor: g?.valorContribuicao }),
      });
      setMsg("Contribuição marcada como paga.");
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  if (!g) return <p>A abrir o grupo…</p>;

  const datas = Array.from(new Set(g.contributions.map((c) => c.dataPrevista.slice(0, 10))));

  return (
    <div>
      <Link href="/xitique" style={{ color: "var(--verde-vida)", fontWeight: 700, textDecoration: "none" }}>
        ← Grupos
      </Link>
      <h1 className="display" style={{ fontSize: "1.7rem", marginTop: 8 }}>
        {g.nome}
      </h1>
      <p>
        Total no grupo: <Money value={g.total_acumulado} />
      </p>
      <p style={{ color: "var(--cinza-suave)" }}>Código para entrar: {g.codigoConvite}</p>
      <div className="capulana-line" style={{ margin: "12px 0 16px" }} />

      <strong>Quem está</strong>
      {g.members.map((m) => {
        const mine = g.contributions.filter((c) => c.userId === m.userId);
        const pendente = mine.find((c) => c.estado !== "pago");
        return (
          <div className="list-row" key={m.id}>
            <div className="icon-blob">{m.nome.slice(0, 1)}</div>
            <div style={{ flex: 1 }}>{m.nome}</div>
            <span className={pendente?.estado === "atrasado" ? "prejuizo" : pendente ? "" : "lucro"} style={{ fontWeight: 700 }}>
              {pendente ? (pendente.estado === "atrasado" ? "Atrasado" : "À espera") : "Pago"}
            </span>
          </div>
        );
      })}

      <strong style={{ display: "block", marginTop: 18 }}>Calendário</strong>
      {datas.map((d) => (
        <div key={d} className="list-row">
          <div>{new Date(d).toLocaleDateString("pt-MZ")}</div>
          <div style={{ marginLeft: "auto", color: "var(--cinza-suave)" }}>
            {g.contributions.filter((c) => c.dataPrevista.startsWith(d) && c.estado === "pago").length}/
            {g.members.length} pagaram
          </div>
        </div>
      ))}

      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={pagar}>
        Marcar a minha contribuição
      </button>
      {msg ? <div className="toast">{msg}</div> : null}
    </div>
  );
}
