"use client";

import { Journey } from "@/components/Journey";
import { UserMe, api } from "@/lib/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(null);
  const [idioma, setIdioma] = useState("pt");
  const [notificacoes, setNotificacoes] = useState(true);

  useEffect(() => {
    api<UserMe>("/api/users/me").then((u) => {
      setUser(u);
      setIdioma(u.idioma || "pt");
      setNotificacoes(u.notificacoes !== false);
    });
  }, []);

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/entrar");
  }

  async function guardarPrefs() {
    await api("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({ idioma, notificacoes }),
    });
  }

  if (!user) return <p>A abrir o teu perfil…</p>;
  const faltaFoto = !user.fotoUrl;

  return (
    <div>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--verde-vida)",
            color: "var(--areia)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--fonte-display)",
            fontSize: "1.8rem",
            overflow: "hidden",
          }}
        >
          {user.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            user.nome.slice(0, 1)
          )}
        </div>
        <div>
          <h1 className="display" style={{ fontSize: "1.6rem" }}>
            {user.nome}
          </h1>
          <div style={{ color: "var(--cinza-suave)" }}>{user.telefone.replace(/(\d{2})(\d{3})(\d{4})/, "$1 $2 $3")}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <strong>Nível de confiança {user.nivelKyc} de 3</strong>
        <div className="kyc-bar">
          <span className="on" />
          <span className={user.nivelKyc >= 2 ? "on" : ""} />
          <span className={user.nivelKyc >= 3 ? "on" : ""} />
        </div>
        <p style={{ margin: "10px 0 0", color: "var(--cinza-suave)" }}>
          {user.nivelKyc === 1
            ? faltaFoto
              ? "Para o nível 1 ficar completo, falta a tua foto. O crédito só vem no nível 3 — ainda não é desta."
              : `Nível 1: telemóvel e foto. Faltam ${Math.max(0, 14 - user.diasComTransacoes)} dias de caixa para o Xitique.`
            : user.nivelKyc === 2
              ? "Já podes criar e entrar em grupos de xitique. O crédito continua mais à frente."
              : "Caminho da caixa completo."}
        </p>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <strong>O teu caminho</strong>
        <p style={{ color: "var(--cinza-suave)", fontSize: "0.92rem" }}>
          O crédito é consequência — não o ponto de partida.
        </p>
        <Journey nivelKyc={user.nivelKyc} dias={user.diasComTransacoes} />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <strong>A tua pessoa de confiança</strong>
        {user.agente ? (
          <>
            <p style={{ margin: "8px 0 0" }}>{user.agente.nome}</p>
            <p style={{ color: "var(--cinza-suave)", margin: 0 }}>{user.agente.quiosqueLocalizacao}</p>
            <p style={{ margin: "6px 0 0" }}>Telefone: {user.agente.contacto}</p>
          </>
        ) : (
          <p>Ainda não tens agente ligado. No mercado, alguém do Ukuphila pode apresentar-te.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <strong>Definições</strong>
        <p>Idioma</p>
        <div className="chip-row">
          <button className={`chip ${idioma === "pt" ? "on" : ""}`} onClick={() => setIdioma("pt")}>
            Português
          </button>
          <button className={`chip ${idioma === "citsonga" ? "on" : ""}`} onClick={() => setIdioma("citsonga")}>
            Xichangana
          </button>
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 48, marginTop: 8 }}>
          <input type="checkbox" checked={notificacoes} onChange={(e) => setNotificacoes(e.target.checked)} />
          Avisos no telemóvel
        </label>
        <button className="btn btn-ghost" onClick={guardarPrefs}>
          Guardar definições
        </button>
      </div>

      <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={sair}>
        Terminar sessão
      </button>
    </div>
  );
}
