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
  parseStoredVars,
  PROFILE_IDS,
  profileForVars,
  STORAGE_KEY,
  substitutePlaceholders
} from "../../components/cluster-config-panel";

describe("parseStoredVars", () => {
  it("returns nothing when nothing was ever stored", () => {
    expect(parseStoredVars(null)).toEqual({});
  });

  it("keeps a well-formed string map", () => {
    expect(parseStoredVars('{"SPARK_IP":"10.0.0.5","MODEL":"kimi"}')).toEqual({
      SPARK_IP: "10.0.0.5",
      MODEL: "kimi"
    });
  });

  it("returns nothing for storage that is not JSON", () => {
    expect(parseStoredVars("not json")).toEqual({});
  });

  it("returns nothing when storage holds a non-object", () => {
    // A reader or another extension can put anything under the key.
    expect(parseStoredVars('"a string"')).toEqual({});
    expect(parseStoredVars("42")).toEqual({});
    expect(parseStoredVars("null")).toEqual({});
  });

  it("drops a non-string value and keeps the rest", () => {
    // One bad entry must not cost a reader the variables they actually typed.
    expect(parseStoredVars('{"good":"keep","bad":{"nested":true},"also_bad":7}')).toEqual({
      good: "keep"
    });
  });

  it("returns nothing for an empty object", () => {
    expect(parseStoredVars("{}")).toEqual({});
  });
});

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

  it("survives a record with no added nodes at all", () => {
    expect(needsSubstitution([{}, { addedNodes: null }] as never)).toBe(false);
  });

  it("survives a callback handed no records", () => {
    expect(needsSubstitution(undefined as never)).toBe(false);
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

  it("ignores a stored null instead of putting the string null in an address", () => {
    // A hand-edited or half-written localStorage entry can carry an explicit null. The reader
    // must get the default back, not `ssh root@null`.
    expect(mergeVars(DEFAULT_VARS, { SPARK0_IP: null as unknown as string }).SPARK0_IP).toBe(
      "localhost"
    );
  });

  it("ignores a stored undefined instead of putting the string undefined in a namespace", () => {
    expect(mergeVars(DEFAULT_VARS, { NAMESPACE: undefined as unknown as string }).NAMESPACE).toBe(
      "ai-inference"
    );
  });

  it("matches no profile when the address is missing from the set entirely", () => {
    expect(profileForVars({ NAMESPACE: "ai-inference" })).toBeUndefined();
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

  it("leaves a token untouched when its variable is blank, rather than publishing an empty address", () => {
    expect(substitutePlaceholders("ssh root@{{SPARK0_IP}}", { SPARK0_IP: "" }))
      .toBe("ssh root@{{SPARK0_IP}}");
  });

  it("leaves the variables alone when no profile is chosen", () => {
    const vars = { ...DEFAULT_VARS, SPARK0_IP: "10.0.0.5" };
    expect(applyProfile(undefined, vars)).toBe(vars);
    expect(vars.SPARK0_IP).toBe("10.0.0.5");
  });

  it("forces localhost back on the one-node profile, whatever address was typed", () => {
    const vars = applyProfile("1node", { ...DEFAULT_VARS, SPARK0_IP: "10.0.0.5" });
    expect(vars.SPARK0_IP).toBe("localhost");
    expect(profileForVars(vars)).toBe("1node");
  });

  it("fills the dashboard port from the profile only when the set has none", () => {
    const filled = applyProfile("3node", { SPARK0_IP: "10.0.0.10", NAMESPACE: "ai-inference" });
    expect(filled.DASHBOARD_PORT).toBe("32082");
    const kept = applyProfile("3node", { ...DEFAULT_VARS, DASHBOARD_PORT: "30001" });
    expect(kept.DASHBOARD_PORT).toBe("30001");
  });

  it("applies the two-node profile over a one-node set", () => {
    const vars = applyProfile("2node", { ...DEFAULT_VARS });
    expect(vars.SPARK0_IP).toBe("192.168.1.10");
    expect(profileForVars(vars)).toBe("2node");
  });

  it("offers one profile per supported lab topology", () => {
    expect(PROFILE_IDS).toEqual(["1node", "2node", "3node", "4node", "5node"]);
  });

  it("applies the three-node ring profile over the defaults", () => {
    const vars = applyProfile("3node", { ...DEFAULT_VARS });
    expect(vars.SPARK0_IP).toBe("10.0.0.10");
    expect(vars.NAMESPACE).toBe("ai-inference");
    expect(vars.DASHBOARD_PORT).toBe("32082");
  });

  it("applies the four- and five-node switch profiles over the defaults", () => {
    for (const profile of ["4node", "5node"]) {
      const vars = applyProfile(profile, { ...DEFAULT_VARS });
      expect(vars.SPARK0_IP).toBe("10.0.0.10");
    }
  });

  it("still maps a custom multi-node address to no profile", () => {
    // The shared 10.0.0.x orchestrator subnet must not light up a specific
    // fabric by IP alone; only 1node/2node keep their IP reverse-mapping.
    expect(profileForVars({ SPARK0_IP: "10.0.0.10" })).toBeUndefined();
  });

  it("keeps the storage key the MkDocs widget used so returning readers keep their values", () => {
    expect(STORAGE_KEY).toBe("dgx-lab-docs-cluster-vars");
  });
});
