"use client";

import { PocketBag } from "@/components/PocketBag";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();

  const screens = [
    {
      title: "O teu negócio, mais claro todos os dias",
      body: "Vês o que entrou, o que saiu, e o que é teu — sem papéis e sem palavras difíceis.",
    },
    {
      title: "Dois bolsos. Como já fazes.",
      body: "O dinheiro do negócio fica num sítio. O da casa, noutro. Tu decides o que passa de um para o outro.",
    },
    {
      title: "Só o teu número e uma foto",
      body: "Sem filas. Sem papelada. Começas hoje, no teu telemóvel.",
    },
  ];
  const s = screens[step];

  return (
    <div className="phone-frame app-shell">
      <div className="onboard">
        <div className="onboard-hero">
          <div className="capulana-line" />
          {step === 1 ? (
            <div style={{ display: "grid", gap: 12, margin: "12px 0" }}>
              <PocketBag tipo="negocio" saldo={8450} />
              <PocketBag tipo="casa" saldo={2180} />
            </div>
          ) : (
            <div
              style={{
                height: 180,
                borderRadius: 24,
                background: "var(--verde-claro)",
                display: "grid",
                placeItems: "center",
                fontSize: "4rem",
              }}
            >
              {step === 0 ? "🌱" : "📷"}
            </div>
          )}
          <h1 className="display" style={{ fontSize: "2.1rem" }}>
            {s.title}
          </h1>
          <p style={{ fontSize: "1.1rem", color: "#4a453e" }}>{s.body}</p>
        </div>
        <div className="dots">
          {screens.map((_, i) => (
            <i key={i} className={i === step ? "on" : ""} />
          ))}
        </div>
        {step < 2 ? (
          <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
            Continuar
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => {
              localStorage.setItem("ukuphila-onboarded", "1");
              router.push("/entrar");
            }}
          >
            Começar agora
          </button>
        )}
      </div>
    </div>
  );
}
