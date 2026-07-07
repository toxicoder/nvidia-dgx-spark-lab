import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { decryptSecret, encryptSecret, valueHint } from "../secrets";

describe("secrets crypto", () => {
  const prev = process.env.LAB_SECRETS_MASTER_KEY;

  beforeEach(() => {
    process.env.LAB_SECRETS_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.LAB_SECRETS_MASTER_KEY;
    else process.env.LAB_SECRETS_MASTER_KEY = prev;
  });

  it("roundtrips plaintext", () => {
    const blob = encryptSecret("sk-test-api-key-12345");
    expect(decryptSecret(blob)).toBe("sk-test-api-key-12345");
  });

  it("detects tampering", () => {
    const blob = encryptSecret("secret");
    const buf = Buffer.from(blob, "base64");
    buf[buf.length - 1] ^= 0xff;
    expect(() => decryptSecret(buf.toString("base64"))).toThrow();
  });

  it("fails with wrong key", () => {
    const blob = encryptSecret("secret");
    process.env.LAB_SECRETS_MASTER_KEY = Buffer.alloc(32, 1).toString("base64");
    expect(() => decryptSecret(blob)).toThrow();
  });

  it("valueHint masks short and long values", () => {
    expect(valueHint("ab")).toBe("••••");
    expect(valueHint("abcdefgh")).toBe("efgh");
  });

  it("rejects invalid master key length", () => {
    process.env.LAB_SECRETS_MASTER_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(() => encryptSecret("secret")).toThrow(/exactly 32 bytes/);
  });

  it("requires LAB_SECRETS_MASTER_KEY in production runtime", () => {
    vi.stubEnv("LAB_SECRETS_MASTER_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("VISUAL_TEST", "");
    delete process.env.LAB_SECRETS_MASTER_KEY;

    expect(() => encryptSecret("secret")).toThrow(/LAB_SECRETS_MASTER_KEY is required/);

    vi.unstubAllEnvs();
  });

  it("allows production build phase without master key", () => {
    delete process.env.LAB_SECRETS_MASTER_KEY;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");

    expect(encryptSecret("build-phase")).toBeTruthy();

    vi.unstubAllEnvs();
  });

  it("uses dev scrypt fallback when key is unset in test", () => {
    delete process.env.LAB_SECRETS_MASTER_KEY;
    vi.stubEnv("NODE_ENV", "test");
    const blob = encryptSecret("dev-only");
    expect(decryptSecret(blob)).toBe("dev-only");
  });

  it("rejects invalid ciphertext blob", () => {
    expect(() => decryptSecret("YQ==")).toThrow(/Invalid ciphertext/);
  });
});
