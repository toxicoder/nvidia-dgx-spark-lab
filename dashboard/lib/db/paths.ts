import path from "path";

/** SQLite file from `DATABASE_URL` (`file:/path/to.db`). */
export function getDbPath(): string {
  return process.env.DATABASE_URL?.replace("file:", "") || "/tmp/lab-dashboard.db";
}

/** Drizzle migrations folder — set `MIGRATIONS_DIR` in container images. */
export function getMigrationsDir(): string {
  return process.env.MIGRATIONS_DIR || path.join(__dirname, "migrations");
}
