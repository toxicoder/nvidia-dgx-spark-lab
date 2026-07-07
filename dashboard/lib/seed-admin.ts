import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";

let seeded = false;

/**
 * Create the initial admin user when LAB_DASHBOARD_ADMIN_* env vars are set
 * and no users exist yet. Idempotent — safe on every request.
 */
export async function ensureAdminUser(): Promise<void> {
  if (seeded || process.env.USE_MOCKS === "1" || process.env.AUTH_BYPASS === "1") {
    return;
  }

  const email = process.env.LAB_DASHBOARD_ADMIN_EMAIL;
  const password = process.env.LAB_DASHBOARD_ADMIN_PASSWORD;
  if (!email || !password) return;

  const existing = await getDb().select().from(user).limit(1);
  if (existing.length > 0) {
    seeded = true;
    return;
  }

  await auth.api.signUpEmail({
    body: { email, password, name: "Lab Admin" }
  });
  seeded = true;
}
