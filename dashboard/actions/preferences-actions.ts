/**
 * User preference persistence (theme id, etc.) backed by SQLite.
 *
 * Thin server-action wrappers around `@/lib/db/repositories/preferences`.
 * All actions require an authenticated session via {@link requireSession}.
 */
"use server";

import { getPreference, setPreference } from "@/lib/db/repositories/preferences";
import { requireSession } from "@/lib/require-session";

/**
 * Read a user preference by key.
 * @param key - Preference key (e.g. theme storage key).
 * @returns Stored value or `null` when unset.
 * @throws When session is missing.
 */
export async function getPreferenceAction(key: string): Promise<string | null> {
  await requireSession();
  return getPreference(key);
}

/**
 * Persist a user preference value.
 * @param key - Preference key.
 * @param value - String value to store.
 * @returns Resolves when the value is written.
 * @throws When session is missing.
 */
export async function setPreferenceAction(key: string, value: string): Promise<void> {
  await requireSession();
  await setPreference(key, value);
}
