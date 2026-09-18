"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

const PROFILE_VARS: Record<string, Record<string, string>> = {
  "1node": { SPARK0_IP: "localhost", NAMESPACE: "ai-inference", DASHBOARD_PORT: "32082" },
  "2node": { SPARK0_IP: "192.168.1.10", NAMESPACE: "ai-inference", DASHBOARD_PORT: "32082" }
};

/**
 * Seed from defaults, then overlay non-empty stored values.
 *
 * @param defaults Values declared by the panel's inputs.
 * @param stored Values read from storage.
 * @returns The merged set; a blank stored value never clobbers a default.
 */
export function mergeVars(defaults: Record<string, string>, stored: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...defaults };
  for (const [key, value] of Object.entries(stored)) {
    if (value === undefined || value === null || String(value).length > 0) out[key] = String(value);
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
    if (key === "localhost" || key === "DASHBOARD_PORT") vars[key] ??= value;
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

/** Read persisted variables, tolerating private-mode storage failures. */
function loadVars(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string>;
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


/** Rewrite every code block that still holds (or once held) a placeholder. */
function updateAllBlocks(vars: Record<string, string>): void {
  for (const code of Array.from(document.querySelectorAll<HTMLElement>(CODE_QUERY + " code"))) {
    const text = code.dataset.originalText ?? code.textContent ?? "";
    if (!code.dataset.originalText && !/\{\{.+\}\}/.test(text)) continue;
    code.dataset.originalText ??= text;
    code.textContent = substitutePlaceholders(text, vars);
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

  const active = profileForVars(vars);

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
              onChange={(event) => commit({ ...varsRef.current, [key]: event.target.value.trim() })}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-profile="1node"
          className={`md-button${active === "1node" ? " md-button--primary" : ""}`}
          onClick={() => commit(applyProfile("1node", { ...varsRef.current }))}
        >
          1-node / localhost profile
        </button>
        <button
          type="button"
          data-profile="2node"
          className={`md-button${active === "2node" ? " md-button--primary" : ""}`}
          onClick={() => commit(applyProfile("2node", { ...varsRef.current }))}
        >
          2-node typical profile
        </button>
        <small>(live updates + copy buttons respect current values)</small>
      </div>
    </div>
  );
}
