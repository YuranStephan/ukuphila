"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { wipeLocal } from "@/lib/offline/idb";
import { Logo } from "../brand";

export function SignedOut() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    wipeLocal()
      .catch(() => undefined)
      .finally(() => setDone(true));
  }, []);
  return (
    <main className="section" style={{ minHeight: "100dvh" }}>
      <div className="container-narrow stack" style={{ ["--gap" as string]: "18px" }}>
        <Logo />
        <h1 className="section-heading">Sessão terminada.</h1>
        <p className="muted">{done ? "Os dados deste telefone foram apagados. Os teus registos continuam guardados no Ukuphila." : "A limpar este telefone…"}</p>
        <Link className="btn btn-primary" href="/entrar" style={{ alignSelf: "flex-start" }}>
          Entrar outra vez
        </Link>
      </div>
    </main>
  );
}
