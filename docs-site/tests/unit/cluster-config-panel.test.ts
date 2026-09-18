/**
 * Tests for the cluster-variables panel's mutation guard.
 *
 * The panel rewrites code blocks in place.  Assigning `textContent` replaces a text node,
 * which is itself a childList mutation, so an observer that reacts to every record retriggers
 * itself without end — the original MkDocs widget avoided this by only considering inserted
 * elements, and the port has to keep doing so.
 */

import { describe, expect, it } from "vitest";

import {
  applyProfile,
  CODE_QUERY,
  DEFAULT_VARS,
  mergeVars,
  needsSubstitution,
  profileForVars,
  STORAGE_KEY,
  substitutePlaceholders
} from "../../components/cluster-config-panel";

/** Minimal stand-in for an inserted element. */
function elementNode(fields: {
  tagName?: string;
  classes?: string[];
  descendants?: string[];
}): unknown {
  const tagName = fields.tagName ?? "DIV";
  const classes = fields.classes ?? [];
  const descendants = fields.descendants ?? [];
  return {
    nodeType: 1,
    tagName,
    classList: { contains: (name: string) => classes.includes(name) },
    querySelector: (selector: string) => (descendants.includes(selector) ? {} : null)
  };
}

/** Minimal stand-in for an inserted text node, which must be ignored. */
const textNode = { nodeType: 3, tagName: undefined, querySelector: undefined };

const record = (added: unknown[]): unknown => ({ addedNodes: added });

describe("needsSubstitution", () => {
  it("ignores a text-only mutation, which is what a rewrite itself produces", () => {
    expect(needsSubstitution([record([textNode])] as never)).toBe(false);
  });

  it("ignores an empty record", () => {
    expect(needsSubstitution([record([])] as never)).toBe(false);
  });

  it("ignores inserted elements that hold no code", () => {
    expect(needsSubstitution([record([elementNode({})])] as never)).toBe(false);
  });

  it("reacts to an inserted code element", () => {
    expect(needsSubstitution([record([elementNode({ tagName: "CODE" })])] as never)).toBe(true);
  });

  it("reacts to an inserted pre element", () => {
    expect(needsSubstitution([record([elementNode({ tagName: "PRE" })])] as never)).toBe(true);
  });

  it("reacts to an inserted highlight wrapper", () => {
    expect(
      needsSubstitution([record([elementNode({ classes: ["highlight"] })])] as never)
    ).toBe(true);
  });

  it("reacts to an inserted container that holds code deeper down", () => {
    expect(
      needsSubstitution([record([elementNode({ descendants: [CODE_QUERY] })])] as never)
    ).toBe(true);
  });

  it("reacts when only one record of several carries code", () => {
    const records = [record([textNode]), record([elementNode({})]), record([elementNode({ tagName: "CODE" })])];
    expect(needsSubstitution(records as never)).toBe(true);
  });

  it("survives a record whose nodes lack the optional members", () => {
    expect(needsSubstitution([{ addedNodes: [{ nodeType: 1 }] }] as never)).toBe(false);
  });
});


/**
 * The seed/merge/profile/substitute contract.
 *
 * This is the behaviour the MkDocs widget documented in `docs/test_command_vars.py` and it is
 * what keeps a reader-edited address from being clobbered by a stored blank, or a known token
 * from being left on screen as a literal `{{TOKEN}}`.
 */
describe("cluster variable contract", () => {
  it("keeps the defaults when nothing is stored", () => {
    expect(mergeVars(DEFAULT_VARS, {}).SPARK0_IP).toBe("localhost");
    expect(mergeVars(DEFAULT_VARS, {}).NAMESPACE).toBe("ai-inference");
  });

  it("lets a stored value win over the default", () => {
    expect(mergeVars(DEFAULT_VARS, { SPARK0_IP: "192.168.1.10" }).SPARK0_IP).toBe("192.168.1.10");
  });

  it("ignores a blank stored value rather than clobbering the default", () => {
    expect(mergeVars(DEFAULT_VARS, { SPARK0_IP: "" }).SPARK0_IP).toBe("localhost");
  });

  it("maps the known addresses to a profile and a custom one to none", () => {
    expect(profileForVars({ SPARK0_IP: "localhost" })).toBe("1node");
    expect(profileForVars({ SPARK0_IP: "127.0.0.1" })).toBe("1node");
    expect(profileForVars({ SPARK0_IP: "192.168.1.10" })).toBe("2node");
    expect(profileForVars({ SPARK0_IP: "10.0.0.5" })).toBeUndefined();
  });

  it("resolves every known token so no raw placeholder is left visible", () => {
    const merged = mergeVars(DEFAULT_VARS, {});
    const out = substitutePlaceholders("http://{{SPARK0_IP}}:{{DASHBOARD_PORT}}", merged);
    expect(out).toBe("http://localhost:32082");
    expect(out).not.toContain("{{");
  });

  it("leaves an unknown token untouched", () => {
    expect(substitutePlaceholders("{{SPARK0_IP}} {{NOT_A_VAR}}", mergeVars(DEFAULT_VARS, {})))
      .toBe("localhost {{NOT_A_VAR}}");
  });

  it("applies the two-node profile over a one-node set", () => {
    const vars = applyProfile("2node", { ...DEFAULT_VARS });
    expect(vars.SPARK0_IP).toBe("192.168.1.10");
    expect(profileForVars(vars)).toBe("2node");
  });

  it("keeps the storage key the MkDocs widget used so returning readers keep their values", () => {
    expect(STORAGE_KEY).toBe("dgx-lab-docs-cluster-vars");
  });
});
