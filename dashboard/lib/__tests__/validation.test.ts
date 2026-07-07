import { describe, it, expect } from "vitest";
import { PathSchema, UtilityNameSchema, RelativeRedirectSchema, ContainerIdSchema } from "../validation";

describe("validation schemas", () => {
  it("PathSchema rejects paths outside whitelist", () => {
    expect(() => PathSchema.parse({ path: "/etc/passwd" })).toThrow();
    expect(() => PathSchema.parse({ path: "/mnt/models-evil" })).toThrow();
    expect(PathSchema.parse({ path: "/mnt/models/foo" }).path).toBe("/mnt/models/foo");
  });

  it("UtilityNameSchema enforces allow-list", () => {
    expect(UtilityNameSchema.parse("spark-clock")).toBe("spark-clock");
    expect(() => UtilityNameSchema.parse("evil-script")).toThrow();
  });

  it("RelativeRedirectSchema blocks open redirects", () => {
    expect(RelativeRedirectSchema.parse("/dashboard")).toBe("/dashboard");
    expect(() => RelativeRedirectSchema.parse("//evil.com")).toThrow();
    expect(() => RelativeRedirectSchema.parse("https://evil.com")).toThrow();
  });

  it("ContainerIdSchema rejects injection patterns", () => {
    expect(() => ContainerIdSchema.parse("bad;id")).toThrow();
    expect(ContainerIdSchema.parse("abc123")).toBe("abc123");
  });
});
