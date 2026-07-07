import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertTestBypassAllowed } from "../env-guards";

describe("assertTestBypassAllowed", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv, NODE_ENV: "test" };
    delete process.env.AUTH_BYPASS;
    delete process.env.USE_MOCKS;
    delete process.env.VISUAL_TEST;
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("allows AUTH_BYPASS in non-production", () => {
    process.env.AUTH_BYPASS = "1";
    expect(() => assertTestBypassAllowed()).not.toThrow();
  });

  it("allows USE_MOCKS in non-production", () => {
    process.env.USE_MOCKS = "1";
    expect(() => assertTestBypassAllowed()).not.toThrow();
  });

  it("allows bypass flags when VISUAL_TEST=1 in production", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      VISUAL_TEST: "1",
      AUTH_BYPASS: "1",
      USE_MOCKS: "1"
    };
    expect(() => assertTestBypassAllowed()).not.toThrow();
  });

  it("forbids AUTH_BYPASS in production", () => {
    process.env = { ...process.env, NODE_ENV: "production", AUTH_BYPASS: "1" };
    expect(() => assertTestBypassAllowed()).toThrow(/AUTH_BYPASS/);
  });

  it("forbids USE_MOCKS in production", () => {
    process.env = { ...process.env, NODE_ENV: "production", USE_MOCKS: "1" };
    expect(() => assertTestBypassAllowed()).toThrow(/USE_MOCKS/);
  });

  it("forbids VISUAL_TEST bypass flags at runtime without VISUAL_TEST harness", () => {
    process.env = { ...process.env, NODE_ENV: "production", AUTH_BYPASS: "1" };
    expect(() => assertTestBypassAllowed()).toThrow(/AUTH_BYPASS/);
  });

  it("skips checks during Next.js production build phase", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      AUTH_BYPASS: "1"
    };
    expect(() => assertTestBypassAllowed()).not.toThrow();
  });
});
