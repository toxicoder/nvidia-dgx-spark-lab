/**
 * Combined Drizzle schema: Better Auth tables + dashboard app tables.
 */
export * from "./auth-schema";

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const preferences = sqliteTable("preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value")
});

export type Preference = typeof preferences.$inferSelect;

/** Utility run history for dashboard-controllable scripts. */
export const utilityRuns = sqliteTable("utility_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  status: text("status"),
  started_at: integer("started_at"),
  output: text("output"),
  exit_code: integer("exit_code")
});

export type UtilityRun = typeof utilityRuns.$inferSelect;

/** Encrypted lab secrets vault (ciphertext only; master key in env). */
export const labSecrets = sqliteTable("lab_secrets", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  category: text("category").notNull(),
  description: text("description"),
  ciphertext: text("ciphertext").notNull(),
  value_hint: text("value_hint").notNull(),
  k8s_sync_namespace: text("k8s_sync_namespace"),
  k8s_sync_secret_name: text("k8s_sync_secret_name"),
  k8s_sync_key: text("k8s_sync_key"),
  created_at: integer("created_at").notNull(),
  updated_at: integer("updated_at").notNull(),
  created_by: text("created_by")
});

export type LabSecretRow = typeof labSecrets.$inferSelect;

/** Audit trail for secret mutations (no values stored). */
export const secretAuditEvents = sqliteTable("secret_audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  secret_id: text("secret_id"),
  action: text("action").notNull(),
  actor_email: text("actor_email"),
  created_at: integer("created_at").notNull()
});

export type SecretAuditEvent = typeof secretAuditEvents.$inferSelect;
