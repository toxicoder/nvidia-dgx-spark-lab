import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { assertTestBypassAllowed } from "@/lib/env-guards";

/**
 * Route protection middleware. Redirects unauthenticated users to `/login` and
 * authenticated users away from it.
 *
 * Bypass when `AUTH_BYPASS=1` or `USE_MOCKS=1` (Playwright goldens + Vitest).
 * Public routes: `/login`, `/api/auth/*`. `/dev` is public only outside
 * production — it renders fixture panels, not operator UI, and shipping it on
 * the public host advertised the app's internals.
 */

const PUBLIC_PREFIXES = ["/login", "/api/auth"];

/** Fixture-gallery route, served only in development. */
const DEV_PREFIX = "/dev";

/**
 * Whether a pathname is reachable without a session.
 *
 * @param pathname - Request pathname.
 * @returns True when the route is public for the current environment.
 */
function isPublicPath(pathname: string): boolean {
  if (pathname === DEV_PREFIX || pathname.startsWith(`${DEV_PREFIX}/`)) {
    return process.env.NODE_ENV !== "production";
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Identity forwarded by the front proxy, when proxy auth is trusted.
 *
 * @param request - Incoming request.
 * @returns The forwarded user, or `null` when proxy auth is off or absent.
 */
function proxyAuthUser(request: NextRequest): string | null {
  if (process.env.TRUST_PROXY_AUTH !== "1") return null;
  return (
    request.headers.get("remote-user") ?? request.headers.get("Remote-User") ?? request.headers.get("x-forwarded-user")
  );
}

/**
 * Next.js middleware entry — gate console routes behind a session or proxy auth.
 *
 * @param request - Incoming request with pathname and headers.
 * @returns `NextResponse.next()` for allowed requests, or a redirect.
 */
export function middleware(request: NextRequest): NextResponse {
  assertTestBypassAllowed();

  if (process.env.AUTH_BYPASS === "1" || process.env.USE_MOCKS === "1") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const authenticated = Boolean(proxyAuthUser(request)) || Boolean(getSessionCookie(request));

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isPublicPath(pathname) || authenticated) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

/** Matcher config — applies middleware to all routes except static assets. */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
