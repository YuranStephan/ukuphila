"use client";

export function PocketBag({
  tipo,
  saldo,
  compact,
}: {
  tipo: "negocio" | "casa";
  saldo: number;
  compact?: boolean;
}) {
  const label = tipo === "negocio" ? "Negócio" : "Casa";
  const fmt = Math.round(saldo)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (
    <div className={`pocket-bag ${tipo === "casa" ? "casa" : ""}`} style={compact ? { minHeight: 120 } : undefined}>
      <div className="rim" aria-hidden />
      <div className="stitch" aria-hidden />
      <div className="label">{label}</div>
      <div className="amount tabular">{fmt} MT</div>
    </div>
  );
}
