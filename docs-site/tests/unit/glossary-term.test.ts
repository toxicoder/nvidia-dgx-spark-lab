/**
 * Tests for glossary tooltip placement.
 *
 * Native `title` bubbles are delayed and often suppressed inside Fumadocs table
 * wrappers (`overflow: auto`), so the hover popover is positioned in a portal.
 * Placement has to stay on-screen without a DOM.
 */

import { describe, expect, it } from "vitest";

import { placeGlossaryTooltip } from "../../components/glossary-term";

const tooltip = { width: 200, height: 40 };
const viewport = { width: 1000, height: 800 };

describe("placeGlossaryTooltip", () => {
  it("places the tooltip above the term when there is room", () => {
    const pos = placeGlossaryTooltip({ top: 400, left: 400, width: 80, height: 16 }, tooltip, viewport);
    expect(pos.top).toBe(400 - 40 - 8);
    expect(pos.left).toBe(400 + 80 / 2 - 200 / 2);
  });

  it("flips below when the term is near the top of the viewport", () => {
    const pos = placeGlossaryTooltip({ top: 10, left: 400, width: 80, height: 16 }, tooltip, viewport);
    expect(pos.top).toBe(10 + 16 + 8);
  });

  it("clamps to the left edge of the viewport", () => {
    const pos = placeGlossaryTooltip({ top: 400, left: 0, width: 20, height: 16 }, tooltip, viewport);
    expect(pos.left).toBe(8);
  });

  it("clamps to the right edge of the viewport", () => {
    const pos = placeGlossaryTooltip({ top: 400, left: 980, width: 20, height: 16 }, tooltip, viewport);
    expect(pos.left).toBe(1000 - 200 - 8);
  });
});
