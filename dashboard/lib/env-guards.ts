/**
 * Runtime guards for test-only environment flags.
 * Prevents AUTH_BYPASS / USE_MOCKS from weakening production deployments.
 */
export function assertTestBypassAllowed(): void {
  if (process.env.NODE_ENV !== "production") return;

  // Next.js evaluates server modules during `next build` (VISUAL_TEST may be set).
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Playwright/Docker visual harness only — never set VISUAL_TEST=1 in real deployments.
  if (process.env.VISUAL_TEST === "1") return;

  if (process.env.AUTH_BYPASS === "1") {
    throw new Error("AUTH_BYPASS=1 is forbidden when NODE_ENV=production");
  }
  if (process.env.USE_MOCKS === "1") {
    throw new Error("USE_MOCKS=1 is forbidden when NODE_ENV=production");
  }
}
