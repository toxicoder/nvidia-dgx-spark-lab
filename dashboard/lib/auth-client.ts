import { createAuthClient } from "better-auth/react";

/**
 * Client-side Better Auth helpers for login and sign-out UI.
 *
 * `NEXT_PUBLIC_BETTER_AUTH_URL` must match the browser-reachable dashboard URL in production.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000"
});
