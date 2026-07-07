import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";

/** Key/value preferences for dashboard UI state (no-op when `USE_MOCKS=1`). */

export async function getPreference(key: string): Promise<string | null> {
  if (process.env.USE_MOCKS === "1") return null;

  const rows = await db.select().from(preferences).where(eq(preferences.key, key)).limit(1);

  return rows[0]?.value ?? null;
}

/** Upsert a dashboard UI preference key/value pair. */
export async function setPreference(key: string, value: string): Promise<void> {
  if (process.env.USE_MOCKS === "1") return;

  await db.insert(preferences).values({ key, value }).onConflictDoUpdate({
    target: preferences.key,
    set: { value }
  });
}
