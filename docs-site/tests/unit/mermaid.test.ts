/**
 * Tests for Mermaid SVG render ids.
 *
 * Mermaid 12 rejects two `render()` calls that share an id, and React `useId()` values
 * contain colons (`:r1:`) that are not legal in the SVG id Mermaid emits.  The helper has
 * to turn those into distinct, CSS-safe ids so every diagram on a page (architecture has
 * five) actually draws on GitHub Pages.
 */

import { describe, expect, it } from "vitest";

import { mermaidRenderId } from "../../components/mermaid";

const CSS_ID = /^[A-Za-z][A-Za-z0-9_-]*$/u;

describe("mermaidRenderId", () => {
  it("sanitizes a React useId value into a CSS-safe id", () => {
    expect(mermaidRenderId(":r1:")).toBe("mmdr1");
    expect(mermaidRenderId(":r1:")).toMatch(CSS_ID);
  });

  it("keeps two React ids distinct after sanitizing", () => {
    expect(mermaidRenderId(":r1:")).not.toBe(mermaidRenderId(":r2:"));
  });

  it("always starts with a letter even when the React id is only punctuation", () => {
    expect(mermaidRenderId(":::")).toMatch(CSS_ID);
  });
});
