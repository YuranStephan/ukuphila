/** Money is integer centavos. Display uses a thin no-break space as the thousands separator: 12 500 MT. */
const THIN = " ";

function group(value: number) {
  return Math.abs(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
}

export function formatMT(cents: number, opts: { sign?: boolean; decimals?: boolean } = {}) {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = absolute % 100;
  const showDecimals = opts.decimals || fraction !== 0;
  const body = `${group(whole)}${showDecimals ? `,${String(fraction).padStart(2, "0")}` : ""}${THIN}MT`;
  if (opts.sign) return `${negative ? "−" : "+"}${body}`;
  return negative ? `−${body}` : body;
}

/** Compact form for chart labels and dense tables: 1,2 mil / 3,4 M. */
export function formatCompact(cents: number) {
  const value = Math.abs(cents) / 100;
  const sign = cents < 0 ? "−" : "";
  if (value >= 1_000_000) return `${sign}${(value / 1_000_000).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} M`;
  if (value >= 1_000) return `${sign}${(value / 1_000).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} mil`;
  return `${sign}${Math.round(value)}`;
}

export function toCents(meticais: number) {
  return Math.round(meticais * 100);
}

/** Accepts "1 500", "1.500", "1500,50" and "1500.50". Returns null when it is not a positive amount. */
export function parseAmountToCents(input: string): number | null {
  const clean = input.replace(/\s| |mt|meticais/gi, "");
  if (!clean) return null;
  const decimal = clean.match(/^(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?$/);
  if (!decimal) return null;
  const whole = Number(decimal[1].replace(/\./g, ""));
  const fraction = decimal[2] ? Number(decimal[2].padEnd(2, "0")) : 0;
  const cents = whole * 100 + fraction;
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function pct(part: number, whole: number) {
  return whole > 0 ? part / whole : 0;
}

export function formatPct(value: number, digits = 0) {
  return `${(value * 100).toLocaleString("pt-PT", { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}
