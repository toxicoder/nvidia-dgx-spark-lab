/**
 * Tests for the cluster-variables panel's reader-facing behaviour.
 *
 * CONTRACT: a reader types a cluster address, a namespace and a dashboard port once, and
 * every `{{TOKEN}}` code example on the page follows immediately, including what a Copy
 * button hands out (the examples are rewritten in place, so the copy source is the rewritten
 * text).  The values persist under the MkDocs widget's storage key, so a returning reader
 * sees what they typed last time; broken or unavailable storage must never stop the panel
 * working for the current page load.  A topology profile button is the other way in: it
 * pre-fills a whole lab topology and marks itself active.
 *
 * The pure seed/merge/profile/substitute contract is pinned in `cluster-config-panel.test.ts`
 * (and by `docs/test_command_vars.py`); here the question is what the reader can observe.
 * Examples are therefore asserted through their visible text, which is what a reader and a
 * Copy button see, rather than through the node the rewrite happens to claim.
 */

import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ClusterConfigPanel,
  DEFAULT_VARS,
  PROFILE_IDS,
  STORAGE_KEY
} from "../../components/cluster-config-panel";

/** Quiet period the panel uses to coalesce a burst of insertions. */
const DEBOUNCE_MS = 32;

/** The handle `docs/test_command_vars.py` expects on the window. */
interface CommandVarsBridge {
  mergeVars?: unknown;
  profileForVars?: unknown;
  applyProfile?: unknown;
}

function bridge(): CommandVarsBridge | undefined {
  return (window as unknown as { __dgxCommandVars?: CommandVarsBridge }).__dgxCommandVars;
}

/**
 * A code example as a rendered page would have left it: a highlight wrapper around a `pre`
 * around the `code` the reader copies.
 */
function example(fields: { shows: string; tag: string }): HTMLElement {
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = fields.shows;
  pre.dataset.testExample = fields.tag;
  pre.append(code);
  return pre;
}

/** Put an example where the reader would see it, inside the observed subtree. */
function intoBody(node: HTMLElement): HTMLElement {
  document.body.append(node);
  return node;
}

/**
 * Put an example where only a rewrite pass can reach it.
 *
 * The panel observes mutations under `document.body` but rewrites whatever its query finds
 * document-wide.  Hanging an example off the root element gives a witness the mutation
 * observer never reports and a pass still updates, so "still raw" proves no pass ran.
 */
function intoUnobservedCorner(node: HTMLElement): HTMLElement {
  document.documentElement.append(node);
  return node;
}

/** What the example shows a reader, which is also what its Copy button hands out. */
function exampleText(tag: string): string {
  const node = document.querySelector<HTMLElement>(`[data-test-example="${tag}"]`);
  expect(node, `example ${tag}`).not.toBeNull();
  return (node as HTMLElement).textContent ?? "";
}

/** The text a rewrite pass cached as the example's source, if a pass claimed it. */
function cachedSource(node: HTMLElement): string | undefined {
  return (
    node.dataset.originalText ??
    node.querySelector<HTMLElement>("[data-original-text]")?.dataset.originalText
  );
}

/** The input wired to one documented variable. */
function inputOf(container: HTMLElement, key: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`[data-var="${key}"]`);
  expect(input, `input for ${key}`).not.toBeNull();
  return input as HTMLInputElement;
}

/** The profile button for one topology. */
function buttonOf(container: HTMLElement, id: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(`[data-profile="${id}"]`);
  expect(button, `profile button ${id}`).not.toBeNull();
  return button as HTMLButtonElement;
}

/** Which profile buttons the panel is highlighting. */
function activeProfiles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("[data-profile]"))
    .filter((button) => button.className.includes("md-button--primary"))
    .map((button) => button.dataset.profile as string);
}

/** What the panel persisted for the next visit. */
function storedVars(): Record<string, string> {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string>;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  // A debounce timer or an example left behind would leak into the next test, which shares
  // this document with every other test in the file.
  vi.clearAllTimers();
  vi.useRealTimers();
  document.querySelectorAll("[data-test-example]").forEach((node) => node.remove());
  vi.restoreAllMocks();
});

describe("ClusterConfigPanel chrome", () => {
  it("tells the reader that edits propagate to the examples and the copy buttons", () => {
    const { container } = render(<ClusterConfigPanel />);
    expect(container.querySelector("p")?.textContent).toContain(
      "edits propagate to all examples + copies on this page"
    );
    expect(container.textContent).toContain(
      "(live updates + copy buttons respect current values)"
    );
    expect(container.querySelector(".cluster-config")?.getAttribute("data-vars")).toBe(
      "SPARK0_IP,NAMESPACE,DASHBOARD_PORT"
    );
  });

  it("renders one labelled input per documented variable, seeded from the defaults", () => {
    const { container } = render(<ClusterConfigPanel />);
    for (const key of Object.keys(DEFAULT_VARS)) {
      const input = inputOf(container, key);
      expect(input.value).toBe(DEFAULT_VARS[key]);
      expect(input.placeholder).toBe(key.toLowerCase());
      expect(container.textContent).toContain(`${key}:`);
    }
  });

  it("renders one profile button per supported topology", () => {
    const { container } = render(<ClusterConfigPanel />);
    const ids = Array.from(container.querySelectorAll("[data-profile]")).map(
      (node) => node.getAttribute("data-profile") as string
    );
    expect(ids).toEqual(PROFILE_IDS);
    for (const id of PROFILE_IDS) {
      expect(buttonOf(container, id)).toHaveAttribute("type", "button");
    }
  });

  it("publishes the merge, match, and apply helpers for the browser contract checks", () => {
    render(<ClusterConfigPanel />);
    expect(Object.keys(bridge() ?? {}).sort()).toEqual([
      "applyProfile",
      "mergeVars",
      "profileForVars"
    ]);
    expect(typeof bridge()?.mergeVars).toBe("function");
  });

  it("shows the declared default when the committed set has no value for a variable", () => {
    const { container } = render(<ClusterConfigPanel />);
    // A variable declared after the reader's set was committed has no committed value; the
    // input has to fall back to the default rather than render an empty box.
    const added = "GPU_COUNT";
    (DEFAULT_VARS as Record<string, string>)[added] = "4";
    try {
      fireEvent.change(inputOf(container, "NAMESPACE"), { target: { value: "vllm" } });
      const extra = inputOf(container, added);
      expect(extra.value).toBe("4");
      expect(extra.placeholder).toBe("gpu_count");
    } finally {
      delete (DEFAULT_VARS as Record<string, string>)[added];
    }
  });
});

describe("ClusterConfigPanel editing", () => {
  it("substitutes the examples already on the page when the panel mounts", () => {
    intoUnobservedCorner(example({ shows: "ssh {{SPARK0_IP}}", tag: "mounted" }));
    render(<ClusterConfigPanel />);
    expect(exampleText("mounted")).toBe("ssh localhost");
  });

  it("rewrites an example as the reader edits a variable", () => {
    intoUnobservedCorner(example({ shows: "kubectl -n {{NAMESPACE}} get pods", tag: "edit" }));
    const { container } = render(<ClusterConfigPanel />);
    expect(exampleText("edit")).toBe("kubectl -n ai-inference get pods");
    fireEvent.change(inputOf(container, "NAMESPACE"), { target: { value: "vllm" } });
    expect(exampleText("edit")).toBe("kubectl -n vllm get pods");
  });

  it("remembers what the reader typed for the next visit", () => {
    const { container } = render(<ClusterConfigPanel />);
    fireEvent.change(inputOf(container, "DASHBOARD_PORT"), { target: { value: "30001" } });
    expect(storedVars().DASHBOARD_PORT).toBe("30001");
  });

  it("trims what the reader typed before storing or substituting it", () => {
    intoUnobservedCorner(example({ shows: "ssh root@{{SPARK0_IP}}", tag: "trim" }));
    const { container } = render(<ClusterConfigPanel />);
    fireEvent.change(inputOf(container, "SPARK0_IP"), { target: { value: "  192.168.1.10  " } });
    expect(inputOf(container, "SPARK0_IP").value).toBe("192.168.1.10");
    expect(exampleText("trim")).toBe("ssh root@192.168.1.10");
    expect(storedVars().SPARK0_IP).toBe("192.168.1.10");
  });

  it("rewrites an example from the text it first held, not from what it shows", () => {
    intoUnobservedCorner(
      example({ shows: "http://{{SPARK0_IP}}:{{DASHBOARD_PORT}}", tag: "twice" })
    );
    const { container } = render(<ClusterConfigPanel />);
    expect(exampleText("twice")).toBe("http://localhost:32082");
    fireEvent.change(inputOf(container, "SPARK0_IP"), { target: { value: "10.0.0.10" } });
    expect(exampleText("twice")).toBe("http://10.0.0.10:32082");
    fireEvent.change(inputOf(container, "SPARK0_IP"), { target: { value: "localhost" } });
    expect(exampleText("twice")).toBe("http://localhost:32082");
  });

  it("leaves an example that never held a token alone", () => {
    const wrapper = document.createElement("div");
    wrapper.append(
      example({ shows: "docker compose up -d", tag: "plain" }),
      example({ shows: "ssh {{SPARK0_IP}}", tag: "sibling" })
    );
    intoBody(wrapper);
    render(<ClusterConfigPanel />);
    expect(exampleText("sibling")).toBe("ssh localhost");
    expect(exampleText("plain")).toBe("docker compose up -d");
    const plain = wrapper.querySelector("[data-test-example='plain']") as HTMLElement;
    expect(cachedSource(plain)).toBeUndefined();
  });

  it("does not overwrite an example whose text cannot be read", () => {
    const unreadable = example({ shows: "unreadable", tag: "unreadable" });
    const written: string[] = [];
    for (const node of [unreadable, unreadable.querySelector("code") as HTMLElement]) {
      Object.defineProperty(node, "textContent", {
        configurable: true,
        get: () => null,
        set: (value: string) => written.push(value)
      });
    }
    intoUnobservedCorner(unreadable);
    intoUnobservedCorner(example({ shows: "ssh {{SPARK0_IP}}", tag: "readable" }));
    render(<ClusterConfigPanel />);
    expect(exampleText("readable")).toBe("ssh localhost");
    expect(written).toEqual([]);
    expect(cachedSource(unreadable)).toBeUndefined();
  });
});

describe("ClusterConfigPanel profiles", () => {
  it("applies a topology profile and marks that button active", () => {
    intoUnobservedCorner(example({ shows: "ssh {{SPARK0_IP}}", tag: "profile" }));
    const { container } = render(<ClusterConfigPanel />);
    fireEvent.click(buttonOf(container, "3node"));
    expect(inputOf(container, "SPARK0_IP").value).toBe("10.0.0.10");
    expect(exampleText("profile")).toBe("ssh 10.0.0.10");
    expect(activeProfiles(container)).toEqual(["3node"]);
    expect(storedVars().SPARK0_IP).toBe("10.0.0.10");
  });

  it("keeps the dashboard port a reader set while the profile resets the topology", () => {
    const { container } = render(<ClusterConfigPanel />);
    fireEvent.change(inputOf(container, "DASHBOARD_PORT"), { target: { value: "30001" } });
    fireEvent.change(inputOf(container, "NAMESPACE"), { target: { value: "vllm" } });
    fireEvent.click(buttonOf(container, "4node"));
    expect(inputOf(container, "SPARK0_IP").value).toBe("10.0.0.10");
    expect(inputOf(container, "NAMESPACE").value).toBe("ai-inference");
    expect(inputOf(container, "DASHBOARD_PORT").value).toBe("30001");
  });

  it("marks the profile an address belongs to while the reader types it", () => {
    const { container } = render(<ClusterConfigPanel />);
    fireEvent.change(inputOf(container, "SPARK0_IP"), { target: { value: "192.168.1.10" } });
    expect(activeProfiles(container)).toEqual(["2node"]);
    fireEvent.change(inputOf(container, "SPARK0_IP"), { target: { value: "127.0.0.1" } });
    expect(activeProfiles(container)).toEqual(["1node"]);
  });

  it("clears the highlighted profile for an address no topology uses", () => {
    const { container } = render(<ClusterConfigPanel />);
    fireEvent.click(buttonOf(container, "2node"));
    expect(activeProfiles(container)).toEqual(["2node"]);
    fireEvent.change(inputOf(container, "SPARK0_IP"), { target: { value: "10.0.0.5" } });
    expect(activeProfiles(container)).toEqual([]);
  });

  it("restores what a returning reader stored and lights up the profile it matches", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ SPARK0_IP: "192.168.1.10", NAMESPACE: "vllm" })
    );
    const { container } = render(<ClusterConfigPanel />);
    expect(inputOf(container, "SPARK0_IP").value).toBe("192.168.1.10");
    expect(inputOf(container, "NAMESPACE").value).toBe("vllm");
    expect(activeProfiles(container)).toEqual(["2node"]);
  });

  it("falls back to the defaults when storage holds unreadable JSON", () => {
    window.localStorage.setItem(STORAGE_KEY, "{SPARK0_IP: localhost");
    const { container } = render(<ClusterConfigPanel />);
    expect(inputOf(container, "SPARK0_IP").value).toBe("localhost");
    expect(inputOf(container, "DASHBOARD_PORT").value).toBe("32082");
    expect(activeProfiles(container)).toEqual(["1node"]);
  });

  it("falls back to the defaults when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: storage blocked in private mode");
    });
    const { container } = render(<ClusterConfigPanel />);
    expect(inputOf(container, "SPARK0_IP").value).toBe("localhost");
    expect(activeProfiles(container)).toEqual(["1node"]);
  });

  it("keeps the panel live when storage refuses the write", () => {
    intoUnobservedCorner(example({ shows: "ssh {{SPARK0_IP}}", tag: "nosave" }));
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const { container } = render(<ClusterConfigPanel />);
    fireEvent.change(inputOf(container, "SPARK0_IP"), { target: { value: "192.168.1.10" } });
    expect(write).toHaveBeenCalled();
    expect(inputOf(container, "SPARK0_IP").value).toBe("192.168.1.10");
    expect(exampleText("nosave")).toBe("ssh 192.168.1.10");
    expect(activeProfiles(container)).toEqual(["2node"]);
  });
});

describe("ClusterConfigPanel live examples", () => {
  it("rewrites an example the page inserts later, once the burst settles", async () => {
    render(<ClusterConfigPanel />);
    intoBody(example({ shows: "helm upgrade {{NAMESPACE}}", tag: "late" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(exampleText("late")).toBe("helm upgrade {{NAMESPACE}}");
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(exampleText("late")).toBe("helm upgrade ai-inference");
  });

  it("coalesces examples that arrive inside the quiet period into one rewrite", async () => {
    render(<ClusterConfigPanel />);
    intoBody(example({ shows: "ssh {{SPARK0_IP}}", tag: "first" }));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(20);
    intoBody(example({ shows: "http://{{SPARK0_IP}}:{{DASHBOARD_PORT}}", tag: "second" }));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(20);
    expect(exampleText("first")).toBe("ssh {{SPARK0_IP}}");
    expect(exampleText("second")).toBe("http://{{SPARK0_IP}}:{{DASHBOARD_PORT}}");
    await vi.advanceTimersByTimeAsync(20);
    expect(exampleText("first")).toBe("ssh localhost");
    expect(exampleText("second")).toBe("http://localhost:32082");
  });

  it("ignores a mutation that carries no code, which is what a rewrite itself produces", async () => {
    const witness = intoUnobservedCorner(
      example({ shows: "ssh {{NAMESPACE}}", tag: "witness" })
    );
    render(<ClusterConfigPanel />);
    expect(exampleText("witness")).toBe("ssh ai-inference");

    const stale = intoUnobservedCorner(example({ shows: "ping {{NAMESPACE}}", tag: "stale" }));
    const prose = document.createElement("div");
    prose.textContent = "prose only, no code";
    intoBody(prose);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 3);
    expect(exampleText("stale")).toBe("ping {{NAMESPACE}}");
    expect(cachedSource(stale)).toBeUndefined();
  });

  it("stops rewriting once the panel unmounts", async () => {
    const { unmount } = render(<ClusterConfigPanel />);
    unmount();
    intoBody(example({ shows: "ssh {{SPARK0_IP}}", tag: "orphan" }));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 3);
    expect(exampleText("orphan")).toBe("ssh {{SPARK0_IP}}");
  });
});
