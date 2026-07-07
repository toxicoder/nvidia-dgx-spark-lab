import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { assertTestBypassAllowed } from "@/lib/env-guards";

/**
 * Route protection middleware. Redirects unauthenticated users to `/login`.
 *
 * Bypass when `AUTH_BYPASS=1` or `USE_MOCKS=1` (Playwright goldens + Vitest).
 * Public routes: `/login`, `/api/auth/*`, `/dev`.
 */

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/dev"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function proxyAuthUser(request: NextRequest): string | null {
  if (process.env.TRUST_PROXY_AUTH !== "1") return null;
  return (
    request.headers.get("remote-user") ?? request.headers.get("Remote-User") ?? request.headers.get("x-forwarded-user")
  );
}

/**
 * Next.js middleware entry — gate dashboard routes behind session cookie or proxy auth.
 * @param request - Incoming request with pathname and headers.
 * @returns `NextResponse.next()` for allowed requests or redirect to `/login`.
 */
export function middleware(request: NextRequest): NextResponse {
  assertTestBypassAllowed();

  if (process.env.AUTH_BYPASS === "1" || process.env.USE_MOCKS === "1") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (proxyAuthUser(request)) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

/** Matcher config — applies middleware to all routes except static assets. */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
