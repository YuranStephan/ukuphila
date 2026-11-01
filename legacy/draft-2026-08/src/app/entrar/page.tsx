"use client";

import { api } from "@/lib/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EntrarPage() {
  const router = useRouter();
  const [telefone, setTelefone] = useState("841234567");
  const [codigo, setCodigo] = useState("");
  const [fase, setFase] = useState<"tel" | "otp" | "foto">("tel");
  const [foto, setFoto] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [hint, setHint] = useState("");

  async function pedir() {
    setErro("");
    try {
      const r = await api<{ codigo_demo: string }>("/api/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ telefone }),
      });
      setHint(`Código de demonstração: ${r.codigo_demo}`);
      setFase("otp");
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function verificar() {
    try {
      await api("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ telefone, codigo }),
      });
      setFase("foto");
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  function simularFoto() {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><rect fill='#0F5C4D' width='128' height='128'/><circle cx='64' cy='52' r='22' fill='#FAF3E8'/><ellipse cx='64' cy='108' rx='40' ry='28' fill='#FAF3E8'/></svg>`;
    setFoto(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
  }

  async function concluir() {
    if (foto) {
      await api("/api/users/me", { method: "PATCH", body: JSON.stringify({ foto_url: foto }) });
    }
    router.replace("/hoje");
  }

  return (
    <div className="phone-frame app-shell">
      <div className="onboard">
        <h1 className="display" style={{ fontSize: "2rem" }}>
          {fase === "tel" ? "O teu número" : fase === "otp" ? "O código" : "A tua foto"}
        </h1>
        {fase === "tel" ? (
          <>
            <p>É com isto que entras. Nada de papelada.</p>
            <input
              inputMode="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              style={field}
              aria-label="Número de telemóvel"
            />
            <p style={{ color: "var(--cinza-suave)", fontSize: "0.9rem" }}>
              Demonstração: 84 123 4567 — Célia, banca do Zimpeto
            </p>
            <button className="btn btn-primary" onClick={pedir}>
              Enviar código
            </button>
          </>
        ) : null}
        {fase === "otp" ? (
          <>
            <p>{hint || "Escreve o código que chegou."}</p>
            <input
              inputMode="numeric"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              style={field}
              aria-label="Código"
            />
            <button className="btn btn-primary" onClick={verificar}>
              Confirmar código
            </button>
          </>
        ) : null}
        {fase === "foto" ? (
          <>
            <p>Uma foto tua, para as pessoas do mercado te reconhecerem na app.</p>
            <button
              onClick={simularFoto}
              style={{
                width: 160,
                height: 160,
                borderRadius: "50%",
                border: "3px dashed var(--verde-vida)",
                background: "var(--verde-claro)",
                margin: "12px auto",
                display: "block",
                overflow: "hidden",
              }}
            >
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                "Tirar foto"
              )}
            </button>
            <button className="btn btn-primary" onClick={concluir}>
              Entrar
            </button>
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={concluir}>
              Fazer isto depois
            </button>
          </>
        ) : null}
        {erro ? <p className="prejuizo">{erro}</p> : null}
      </div>
    </div>
  );
}

const field: React.CSSProperties = {
  width: "100%",
  minHeight: 56,
  borderRadius: 14,
  border: "1px solid rgba(35,31,26,0.15)",
  padding: "0 14px",
  background: "#fffdf8",
  fontSize: "1.2rem",
  margin: "12px 0",
};
