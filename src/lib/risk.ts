import type { Tone } from "@/components/ui";

export const SEVERITY_LABELS = { critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa" } as const;
export const SEVERITY_TONES: Record<keyof typeof SEVERITY_LABELS, Tone> = { critica: "bad", alta: "bad", media: "warn", baixa: "info" };
export const ALERT_STATUS_LABELS = { aberto: "Aberto", em_revisao: "Em revisão", fechado: "Fechado" } as const;
export const CASE_STATUS_LABELS = { aberto: "Aberto", em_investigacao: "Em investigação", fechado: "Fechado" } as const;
