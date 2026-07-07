import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { assertTestBypassAllowed } from "@/lib/env-guards";
import * as schema from "./schema";
import { getDbPath, getMigrationsDir } from "./paths";

assertTestBypassAllowed();

export { getDbPath, getMigrationsDir } from "./paths";

let singleton: BetterSQLite3Database<typeof schema> | null = null;
let sqliteHandle: Database.Database | null = null;
let migrated = false;

/**
 * Lazy Drizzle singleton with auto-migrate on first access (skipped when `USE_MOCKS=1`).
 * Container entrypoint runs `scripts/migrate.cjs` first; this is a safety net for dev.
 */
export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!singleton) {
    sqliteHandle = new Database(getDbPath());
    singleton = drizzle(sqliteHandle, { schema });
    if (!migrated && process.env.USE_MOCKS !== "1") {
      migrate(singleton, { migrationsFolder: getMigrationsDir() });
      migrated = true;
    }
  }
  return singleton;
}

/** Reset the singleton (tests only). */
export function resetDbForTests(dbPath?: string): void {
  sqliteHandle?.close();
  sqliteHandle = null;
  singleton = null;
  migrated = false;
  if (dbPath) {
    process.env.DATABASE_URL = `file:${dbPath}`;
  }
}

/** Proxy so `db.select()` works while allowing lazy init + test resets. */
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as Function).bind(real) : value;
  }
});

export * from "./schema";
