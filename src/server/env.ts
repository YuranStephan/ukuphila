import "server-only";

export const isProduction = () => process.env.NODE_ENV === "production";

/** Demo mode shows personas and synthetic data. It is an explicit switch, never inferred from the environment. */
export const isDemo = () => process.env.UKUPHILA_DEMO === "1";

export function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3200").replace(/\/$/, "");
}

const devFallback = "ukuphila-desenvolvimento-local-nao-usar-em-producao";

/** Secrets are mandatory outside development: a missing secret must stop the server, not weaken it. */
export function secret(name: "AUTH_SECRET" | "DOCUMENT_KEY" | "CRON_SECRET") {
  const value = process.env[name];
  if (value) return value;
  if (isProduction() && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error(`${name} é obrigatório em produção.`);
  }
  return `${devFallback}:${name}`;
}
