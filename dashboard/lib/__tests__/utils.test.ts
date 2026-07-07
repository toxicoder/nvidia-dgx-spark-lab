import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
  });
});
