export function formatarMT(valor: number) {
  const n = Math.round(valor);
  const sinal = n < 0 ? "-" : "";
  const abs = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sinal}${abs} MT`;
}

export function Money({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`tabular ${className}`}>{formatarMT(value)}</span>;
}
