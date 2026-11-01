import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts") } },
  test: {
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: { AUTH_SECRET: "test-secret-test-secret-test-secret", DOCUMENT_KEY: "dGVzdC1kb2N1bWVudC1rZXktMzItYnl0ZXMtbG9uZyEh" },
  },
});
