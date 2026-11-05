// Database maintenance: migrate | seed | reset | create-admin. Reads DATABASE_URL from the process environment.
import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { hashSecret } from "../src/server/crypto";
import { localDataDir, migratePostgres, openPglite, openPostgres, type Db } from "../src/server/db/client";
import { users } from "../src/server/db/schema";
import { seedIfEmpty } from "../src/server/seed/seed";

const [command, ...args] = process.argv.slice(2);
const url = process.env.DATABASE_URL;

async function open(): Promise<{ db: Db; close: () => Promise<void> }> {
  return url ? openPostgres(url) : openPglite(localDataDir());
}

async function main() {
  switch (command) {
    case "migrate": {
      // DDL goes through the session pooler (5432); the transaction pooler (6543) is for the running app.
      if (url) await migratePostgres(process.env.DATABASE_MIGRATION_URL ?? url.replace(".pooler.supabase.com:6543/", ".pooler.supabase.com:5432/"));
      else await (await openPglite(localDataDir())).close();
      console.log("Migrações aplicadas.");
      return;
    }
    case "seed": {
      const { db, close } = await open();
      await seedIfEmpty(db);
      await close();
      console.log("Dados iniciais prontos.");
      return;
    }
    case "reset": {
      if (url) throw new Error("reset só funciona na base local. Nunca contra uma base alojada.");
      if (!args.includes("--yes")) throw new Error("Confirma com: npm run db:reset -- --yes");
      await rm(localDataDir(), { recursive: true, force: true });
      console.log("Base local apagada. Vai ser recriada no próximo arranque.");
      return;
    }
    case "create-admin": {
      const [email, name] = args;
      if (!email || !name) throw new Error('Uso: npm run db:create-admin -- email@dominio.co.mz "Nome"');
      const { db, close } = await open();
      const password = randomBytes(15).toString("base64url");
      const normalized = email.trim().toLowerCase();
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
      if (existing) {
        await close();
        throw new Error("Já existe uma conta com este identificador. Nenhuma credencial foi alterada.");
      } else {
        await db.insert(users).values({ kind: "staff", role: "admin", email: normalized, displayName: name, status: "activo", passwordHash: await hashSecret(password) });
      }
      await close();
      console.log(`Conta de gestão: ${normalized}\nPalavra-passe temporária (mostrada uma vez): ${password}`);
      return;
    }
    default:
      throw new Error("Comando desconhecido. Usa: migrate | seed | reset | create-admin");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
