// Local development on the embedded database (PGlite), ignoring DATABASE_URL from .env.local.
// `npm run dev:remote` uses the hosted database instead. The two are separate.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const next = require.resolve("next/dist/bin/next");
// An empty value counts as "already set" for Next's env loader, so .env.local cannot override it.
const child = spawn(process.execPath, [next, "dev", "-p", process.env.PORT ?? "3200"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: "", UKUPHILA_DEMO: process.env.UKUPHILA_DEMO ?? "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
