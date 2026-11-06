"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

/**
 * Interactive cluster-variables panel, ported from `docs/assets/javascripts/command-vars.js`.
 *
 * Readers edit `SPARK0_IP`, `NAMESPACE` and `DASHBOARD_PORT`; every `{{TOKEN}}` in the code
 * examples on the page is substituted live and the code blocks' Copy buttons hand out the
 * substituted text.  Values persist in localStorage under the same key the MkDocs widget used,
 * so a returning reader keeps what they typed.
 *
 * The substitution contract is pinned by `docs/test_command_vars.py`: seed from the input
 * defaults, overlay stored values (blank stored values never clobber a default), then apply —
 * so no raw `{{TOKEN}}` is left visible for a known key.
 */

/** Storage key shared with the previous MkDocs widget. */
export const STORAGE_KEY = "dgx-lab-docs-cluster-vars";

/** Variables the panel edits, with the defaults shown in the inputs. */
export const DEFAULT_VARS: Record<string, string> = {
  SPARK0_IP: "localhost",
  NAMESPACE: "ai-inference",
  DASHBOARD_PORT: "32082"
};

/**
 * One profile per supported lab topology (`start/choose-topology.mdx`): 1-node
 * `none`, 2-node `pair`, 3-node `ring`, and the 4/5-node CRS804 `switch`.
 * The multi-node profiles all pre-fill the reference orchestrator address
 * (spark0 on 10.0.0.0/24, `role: orchestrator` in `ansible/inventory/lab.yaml`).
 */
const PROFILE_VARS: Record<string, Record<string, string>> = {
  "1node": { SPARK0_IP: "localhost", NAMESPACE: "ai-inference", DASHBOARD_PORT: "32082" },
  "2node": { SPARK0_IP: "192.168.1.10", NAMESPACE: "ai-inference", DASHBOARD_PORT: "32082" },
  "3node": { SPARK0_IP: "10.0.0.10", NAMESPACE: "ai-inference", DASHBOARD_PORT: "32082" },
  "4node": { SPARK0_IP: "10.0.0.10", NAMESPACE: "ai-inference", DASHBOARD_PORT: "32082" },
  "5node": { SPARK0_IP: "10.0.0.10", NAMESPACE: "ai-inference", DASHBOARD_PORT: "32082" }
};

/** Profile ids in display order — one button per supported topology. */
export const PROFILE_IDS = Object.keys(PROFILE_VARS);

/** Button labels matching the topology tab vocabulary used across the docs. */
const PROFILE_LABELS: Record<string, string> = {
  "1node": "1-node / localhost profile",
  "2node": "2-node typical profile",
  "3node": "3-node ring profile",
  "4node": "4-node switch profile",
  "5node": "5-node switch profile"
};

/**
 * Seed from defaults, then overlay stored values that carry something.
 *
 * @param defaults Values declared by the panel's inputs.
 * @param stored Values read from storage.
 * @returns The merged set; a blank, null or undefined stored value never clobbers a default,
 *   so a half-written storage entry cannot put the literal "null" in front of a reader.
 */
export function mergeVars(defaults: Record<string, string>, stored: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...defaults };
  for (const [key, value] of Object.entries(stored)) {
    if (value !== undefined && value !== null && String(value).length > 0) out[key] = String(value);
  }
  return out;
}

/**
 * Identify the profile a set of variables matches.
 *
 * @param vars Merged variables.
 * @returns `"1node"`, `"2node"`, or `undefined` for a custom address.
 */
export function profileForVars(vars: Record<string, string>): string | undefined {
  const ip = (vars.SPARK0_IP ?? "").trim();
  if (ip === "localhost" || ip === "127.0.0.1") return "1node";
  if (ip === "192.168.1.10") return "2node";
  return undefined;
}

/**
 * Apply a named profile over a set of variables.
 *
 * @param profile Profile id from the profile buttons.
 * @param vars Variables to update in place.
 * @returns The same object, updated.
 */
export function applyProfile(profile: string | undefined, vars: Record<string, string>): Record<string, string> {
  const preset = profile ? PROFILE_VARS[profile] : undefined;
  if (!preset) return vars;
  for (const [key, value] of Object.entries(preset)) {
    // A reader who picked their own dashboard port keeps it; every other preset value is the
    // profile's to set. The preset keys come from PROFILE_VARS, which declares only
    // SPARK0_IP, NAMESPACE and DASHBOARD_PORT.
    if (key === "DASHBOARD_PORT") vars[key] ??= value;
    else vars[key] = value;
  }
  if (profile === "1node") vars.SPARK0_IP = "localhost";
  if (profile === "2node") vars.SPARK0_IP = "192.168.1.10";
  return vars;
}

/**
 * Replace `{{KEY}}` tokens with variable values, leaving unknown or blank keys intact.
 *
 * @param text Source text, typically the original contents of a code block.
 * @param vars Merged variables.
 * @returns The text with every known token resolved.
 */
export function substitutePlaceholders(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined || value === null || value === "") continue;
    out = out.replaceAll(`{{${key}}}`, String(value));
  }
  return out;
}

/**
 * What browser storage is allowed to hold: an object with string keys.
 *
 * The value is reader-editable (devtools, another extension, the MkDocs widget that used the
 * same key), so nothing is trusted past the key.
 */
const storedVarsSchema = z.record(z.string(), z.unknown());

/**
 * Read the variables a reader left in browser storage.
 *
 * @param raw The raw string from storage, or `null` when nothing was ever stored.
 * @returns The entries that really are string-to-string. Corrupt JSON, a non-object, or an
 *   entry whose value is not a string yields nothing for that entry rather than discarding
 *   the rest, so one bad key cannot cost a reader the values they typed.
 */
export function parseStoredVars(raw: string | null): Record<string, string> {
  if (raw === null) return {};
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return {};
  }
  const envelope = storedVarsSchema.safeParse(decoded);
  if (!envelope.success) return {};
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(envelope.data)) {
    if (typeof value === "string") vars[key] = value;
  }
  return vars;
}

/** Read persisted variables, tolerating private-mode storage failures. */
function loadVars(): Record<string, string> {
  try {
    return parseStoredVars(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

/** Persist variables, tolerating quota or private-mode failures. */
function saveVars(vars: Record<string, string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vars));
  } catch {
    /* storage unavailable: the panel still works for this page load */
  }
}

/**
 * Selector covering the nodes a substitution pass has to inspect.
 *
 * Kept as one string so the mutation guard and the rewrite agree on what a code block is.
 */
export const CODE_QUERY = "code, pre, .highlight, [data-var-template]";

/**
 * Decide whether a batch of DOM mutations can change what a code block displays.
 *
 * Rewriting a block assigns its text content, which replaces a child text node and is itself
 * a childList mutation, so an observer that answered every record re-armed itself without end.
 * Only insertions that carry or contain code matter, which is what makes this filter the loop
 * breaker.
 *
 * @param records Records handed to the observer callback.
 * @returns True when a substitution pass is worth running.
 */
export function needsSubstitution(records: readonly MutationRecord[]): boolean {
  for (const record of records ?? []) {
    const added = (record && record.addedNodes) || [];
    for (let idx = 0; idx < added.length; idx += 1) {
      const node = added[idx] as Element | undefined;
      if (!node || node.nodeType !== 1) continue;
      const element = node as Element;
      if (element.tagName === "CODE" || element.tagName === "PRE") return true;
      if (element.classList && element.classList.contains("highlight")) return true;
      if (typeof element.querySelector === "function" && element.querySelector(CODE_QUERY)) return true;
    }
  }
  return false;
}

/**
 * Collapse a burst of mutations into a single rewrite.
 *
 * @param fn Work to run once the burst settles.
 * @param delay Quiet period in milliseconds.
 * @returns A callable that restarts the timer on each call.
 */
function debounce<A extends readonly unknown[]>(fn: (...args: A) => void, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}


/** One located token and the text that replaces it. */
type Replacement = { start: number; end: number; text: string };

/** The text a claimed block's nodes held before the panel wrote, and what it last wrote. */
type BlockSource = { original: string[]; written: string[] };

/** One text node of a block, paired with the text it held before the panel wrote. */
type BlockCell = { node: Text; original: string };

/**
 * Per-node record of the blocks a substitution pass has claimed.
 *
 * Re-substitution has to run from the tokens rather than from what is on screen: a reader who
 * types an address and then puts the old one back expects the command to follow. The block's
 * `data-original-text` holds the whole text; this holds the same text split the way the
 * highlighter split it, which is what lets the write-back land in the same nodes. A node whose
 * current text is neither what it held nor what we wrote means the page rebuilt the block, and
 * that block is taken afresh.
 */
const blockSources = new WeakMap<Node, BlockSource>();

/** The text nodes of a block, in document order. */
function textNodesOf(block: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    nodes.push(node as Text);
  }
  return nodes;
}

/**
 * Pair a block's text nodes with the text they held before the panel first wrote them.
 *
 * A block the panel claimed keeps the text it recorded, split the way the highlighter split
 * it, which is what lets the write-back land in the same nodes. A block it has not claimed --
 * or that the page rebuilt, so a node now holds neither the recorded text nor what the panel
 * wrote -- is taken afresh from what the nodes hold.
 *
 * @param block The block a substitution pass is about to rewrite.
 * @returns One cell per text node of the block, in document order.
 */
function claimedCells(block: HTMLElement): BlockCell[] {
  const nodes = textNodesOf(block);
  const source = blockSources.get(block);
  if (source === undefined) return nodes.map((node) => ({ node, original: node.data }));
  const stillOurs =
    source.original.length === nodes.length &&
    nodes.every((node, idx) => {
      const current = node.data;
      return current === source.original[idx] || current === source.written[idx];
    });
  const original = stillOurs ? source.original : nodes.map((node) => node.data);
  return nodes
    .map((node, idx) => ({ node, original: original[idx] }))
    .filter((cell): cell is BlockCell => cell.original !== undefined);
}

/**
 * Rewrite one code block without rebuilding it.
 *
 * The highlighter publishes a block as `pre > code > span.line > span[token]`, so the text a
 * reader sees is spread over many text nodes while a token is one contiguous run inside the
 * block's whole text. Assigning `textContent` to the block resolved the tokens and destroyed the
 * spans carrying the syntax colours along with them, which is what this function exists to
 * avoid: it writes back into the existing text nodes, and a token that straddles two of them is
 * resolved where it starts while its remaining characters simply vanish from the later node. No
 * element is created, moved, or removed.
 *
 * @param block The outermost code block a substitution pass should bring up to date.
 * @param vars Variables to resolve.
 */
function substituteInBlock(block: HTMLElement, vars: Record<string, string>): void {
  const cells = claimedCells(block);
  const original = cells.map((cell) => cell.original);
  const full = original.join("");
  const substituted = substitutePlaceholders(full, vars);
  // Nothing known lives here, or the block already shows what the variables say. Blocks that
  // never held a token are left completely alone, so a plain example keeps the document identity
  // its Copy button may be watching.
  if (substituted === full) return;

  // Locate the tokens the same way `substitutePlaceholders` resolves them, over the variables we
  // actually have. A token for an unknown or blank key is never located and so passes through as
  // literal text, exactly as it would in the plain-string path.
  const located: Replacement[] = [];
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined || value === null || value === "") continue;
    const token = `{{${key}}}`;
    let at = full.indexOf(token);
    while (at !== -1) {
      located.push({ start: at, end: at + token.length, text: String(value) });
      at = full.indexOf(token, at + token.length);
    }
  }
  located.sort((left, right) => left.start - right.start);

  const written: string[] = [];
  let next = 0; // how far into the block's original text the walk has accounted for
  let piece = 0;
  let prefix = 0; // where the current node starts inside that original text
  for (const cell of cells) {
    const end = prefix + cell.original.length;
    prefix = end;
    let text = "";
    let found = located[piece];
    while (found !== undefined && found.start < end) {
      if (found.end <= next) {
        piece += 1; // an earlier node already carried this token
        found = located[piece];
        continue;
      }
      if (found.start > next) text += full.slice(next, found.start);
      // The token's replacement always belongs here: a token that spilled out of an earlier node
      // was already retired by the guard above, so this node is where it begins.
      text += found.text;
      next = Math.max(next, found.end);
      if (found.end > end) break; // the token spills past this node
      piece += 1;
      found = located[piece];
    }
    if (next < end) {
      text += full.slice(next, end);
      next = end;
    }
    written.push(text);
    if (text !== cell.node.data) cell.node.data = text;
  }

  block.dataset.originalText = full;
  blockSources.set(block, { original, written });
}

/** Rewrite every code block that still holds (or once held) a placeholder. */
function updateAllBlocks(vars: Record<string, string>): void {
  for (const block of Array.from(document.querySelectorAll<HTMLElement>(CODE_QUERY))) {
    // The query names a wrapper and the code inside it, so only the outermost match of a nested
    // group is taken. Rewriting a wrapper is meaningless once its text nodes have been updated by
    // the pass above it, and re-entering it would walk the same text nodes twice.
    if (block.parentElement?.closest(CODE_QUERY)) continue;
    substituteInBlock(block, vars);
  }
}

/** Coalesces observer-driven rewrites so a burst of insertions costs one pass. */
const debouncedUpdateAllBlocks = debounce(updateAllBlocks, 32);

/**
 * The panel itself.
 *
 * Rendered wherever a page used `--8<-- "docs/includes/cluster-config.md"`; the include's
 * introductory sentence is rendered here so those pages keep the wording they had.
 */
export function ClusterConfigPanel() {
  const root = useRef<HTMLDivElement>(null);
  const [vars, setVars] = useState<Record<string, string>>(() => mergeVars(DEFAULT_VARS, loadVars()));
  const varsRef = useRef(vars);
  varsRef.current = vars;
  // The multi-node profiles share one reference address, so the active button is tracked
  // from the click (or from a fully-recognizable address on load) rather than back-derived
  // from the variables alone.
  const [activeProfile, setActiveProfile] = useState<string | undefined>(() =>
    profileForVars(mergeVars(DEFAULT_VARS, loadVars()))
  );

  const commit = useCallback((next: Record<string, string>) => {
    varsRef.current = next;
    setVars(next);
    saveVars(next);
    updateAllBlocks(next);
  }, []);

  useEffect(() => {
    // Exposed for the browser contract checks in docs/test_command_vars.py.
    Object.assign(window, { __dgxCommandVars: { mergeVars, profileForVars, applyProfile } });
  }, []);

  useEffect(() => {
    updateAllBlocks(varsRef.current);
    const observer = new MutationObserver((records) => {
      if (!needsSubstitution(records)) return;
      debouncedUpdateAllBlocks(varsRef.current);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root} className="cluster-config" data-vars="SPARK0_IP,NAMESPACE,DASHBOARD_PORT">
      <p className="mt-0 font-semibold">
        Live cluster variables (edits propagate to all examples + copies on this page)
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {Object.keys(DEFAULT_VARS).map((key) => (
          <label key={key} className="inline-flex items-center gap-2">
            {key}:
            <input
              data-var={key}
              value={vars[key] ?? DEFAULT_VARS[key]}
              placeholder={key.toLowerCase()}
              onChange={(event) => {
                const next = { ...varsRef.current, [key]: event.target.value.trim() };
                commit(next);
                setActiveProfile(profileForVars(next));
              }}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {PROFILE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            data-profile={id}
            className={`md-button${activeProfile === id ? " md-button--primary" : ""}`}
            onClick={() => {
              commit(applyProfile(id, { ...varsRef.current }));
              setActiveProfile(id);
            }}
          >
            {PROFILE_LABELS[id]}
          </button>
        ))}
        <small>(live updates + copy buttons respect current values)</small>
      </div>
    </div>
  );
}
