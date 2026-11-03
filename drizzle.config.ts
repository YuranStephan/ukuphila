import { defineConfig } from "drizzle-kit";

// The database may be shared with other projects: everything, including the migration log, stays in "ukuphila".
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  schemaFilter: ["ukuphila"],
  migrations: { table: "__migrations", schema: "ukuphila" },
});
