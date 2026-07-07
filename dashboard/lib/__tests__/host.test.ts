import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { withMock } from "../host";

describe("withMock", () => {
  const prev = process.env.USE_MOCKS;

  afterEach(() => {
    if (prev === undefined) delete process.env.USE_MOCKS;
    else process.env.USE_MOCKS = prev;
  });

  it("returns mock synchronously when USE_MOCKS=1", () => {
    process.env.USE_MOCKS = "1";
    const result = withMock(42, () => 99);
    expect(result).toBe(42);
  });

  it("runs real sync function when mocks disabled", () => {
    delete process.env.USE_MOCKS;
    const result = withMock(42, () => 99);
    expect(result).toBe(99);
  });

  it("runs real async function when mocks disabled", async () => {
    delete process.env.USE_MOCKS;
    const result = await withMock(Promise.resolve(1), async () => 2);
    expect(result).toBe(2);
  });

  beforeEach(() => {
    delete process.env.USE_MOCKS;
  });
});
