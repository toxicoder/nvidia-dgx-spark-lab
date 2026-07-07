import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const isNextBuild = process.env.NEXT_PHASE === "phase-production-build";
if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET && !isNextBuild) {
  throw new Error("BETTER_AUTH_SECRET is required when NODE_ENV=production");
}

/**
 * Server-side Better Auth instance backed by Drizzle + SQLite.
 *
 * Environment:
 * - `BETTER_AUTH_SECRET` — session signing key (required in production)
 * - `BETTER_AUTH_URL` — public base URL (NodePort or ingress)
 *
 * Test/dev bypass: set `AUTH_BYPASS=1` or `USE_MOCKS=1` in middleware instead of weakening this config.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification
    }
  }),
  emailAndPassword: {
    enabled: true
  },
  plugins: [nextCookies()],
  secret: process.env.BETTER_AUTH_SECRET || "dev-only-change-me-in-production",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000"
});
