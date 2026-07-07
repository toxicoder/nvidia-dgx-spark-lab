import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** Thrown when a server action requires auth but no session is available. */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function isTestBypass(): boolean {
  if (process.env.VISUAL_TEST === "1") return true;
  if (process.env.NODE_ENV === "production") return false;
  return process.env.AUTH_BYPASS === "1" || process.env.USE_MOCKS === "1";
}

/** Require an authenticated session for server actions (skipped in non-prod test bypass). */
export async function requireSession(): Promise<void> {
  await requireSessionUser();
}

async function proxyAuthUser(): Promise<{ id: string; email: string } | null> {
  if (process.env.TRUST_PROXY_AUTH !== "1") return null;
  const h = await headers();
  const user = h.get("remote-user") ?? h.get("Remote-User") ?? h.get("x-forwarded-user");
  const email = h.get("remote-email") ?? h.get("Remote-Email");
  if (!user) return null;
  const emailDomain = process.env.LAB_EMAIL_DOMAIN ?? process.env.LAB_LOCAL_DOMAIN ?? "lab.local";
  return { id: `proxy:${user}`, email: email ?? `${user}@${emailDomain}` };
}

/** Session user for audit attribution on sensitive operations. */
export async function requireSessionUser(): Promise<{ id: string; email: string }> {
  if (isTestBypass()) {
    const mockDomain = process.env.LAB_EMAIL_DOMAIN ?? process.env.LAB_LOCAL_DOMAIN ?? "lab.local";
    return { id: "mock-user", email: `mock@${mockDomain}` };
  }

  const proxyUser = await proxyAuthUser();
  if (proxyUser) return proxyUser;

  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user?.email) {
    throw new UnauthorizedError();
  }

  return { id: session.user.id, email: session.user.email };
}
