/**
 * Standalone Drizzle migration runner for container entrypoint.
 * Invoked before `node server.js` so SQLite schema is ready on first request.
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { drizzle } = require("drizzle-orm/better-sqlite3");
const { migrate } = require("drizzle-orm/better-sqlite3/migrator");

const dbPath = (process.env.DATABASE_URL || "file:/data/lab-dashboard.db").replace("file:", "");
const migrationsDir = process.env.MIGRATIONS_DIR || path.join(__dirname, "../lib/db/migrations");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: migrationsDir });
sqlite.close();

console.log(`[dashboard] migrations applied: ${dbPath}`);
