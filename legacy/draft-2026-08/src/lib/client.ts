export const ICONS: Record<string, string> = {
  tomate: "🍅",
  capulana: "🟪",
  peixe: "🐟",
  carvao: "⬛",
  cebola: "🧅",
  caixa: "🧺",
};

export type Pocket = { id: string; tipo: "negocio" | "casa" | string; saldoAtual: number };
export type Product = {
  id: string;
  nomeProduto: string;
  quantidadeAtual: number;
  limiarStockBaixo: number;
  icone: string;
  stock_baixo?: boolean;
};
export type Tx = {
  id: string;
  tipo: string;
  valor: number;
  criadoEm: string;
  pocketId: string;
  nota?: string | null;
  produto?: Product | null;
  precisaRevisao?: boolean;
};
export type UserMe = {
  id: string;
  nome: string;
  telefone: string;
  fotoUrl?: string | null;
  nivelKyc: number;
  diasComTransacoes: number;
  idioma?: string;
  notificacoes?: boolean;
  agente?: { id: string; nome: string; quiosqueLocalizacao: string; contacto: string } | null;
};

const QUEUE_KEY = "ukuphila-queue";

export function enqueue(accao: {
  tipo: string;
  payload: Record<string, unknown>;
  client_uuid: string;
  timestamp: string;
}) {
  const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  q.push(accao);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function flushQueue() {
  const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  if (!q.length || !navigator.onLine) return null;
  const res = await fetch("/api/sync/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acoes: q }),
  });
  if (res.ok) {
    localStorage.setItem(QUEUE_KEY, "[]");
    return res.json();
  }
  return null;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.erro || "Não deu para completar isto agora.");
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return data as T;
}
