/**
 * Port of the MkDocs `abbr` extension plus its auto-appended definitions file.
 *
 * MkDocs read `docs/includes/abbreviations.md` (`*[TERM]: definition` lines) through
 * `pymdownx.snippets` and wrapped each known term in a Material tooltip.  Doing the same as
 * a remark transformer keeps every content page free of the markup: the term stays plain
 * text in the source and becomes an `<abbr>` element at build time.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { visit } from "unist-util-visit";

/**
 * Segments of the shared glossary definitions file below the repository root.
 *
 * Kept as relative segments rather than a resolved path: `path.resolve()` discards its
 * earlier arguments once it sees an absolute one, so baking the working directory in here
 * would make every candidate below point inside `docs-site/` and never find the file.
 */
const DEFINITIONS_SEGMENTS = ["docs", "includes", "abbreviations.md"] as const;

const DEFINITION_LINE = /^\*\[(.+?)]:\s*(.+)$/gm;

/**
 * Locate the glossary definitions file.
 *
 * The compiler runs inside the Next process, whose working directory depends on how the
 * site was launched (`next dev` from `docs-site/`, or a Bazel runfiles tree).  Candidates
 * are tried in order so both work without configuration.
 *
 * @returns Absolute path, or `undefined` when the file cannot be found.
 */
function findDefinitionsFile(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates: string[] = [];
  for (const root of [process.cwd(), here]) {
    let dir = root;
    for (let depth = 0; depth < 7; depth += 1) {
      candidates.push(resolve(dir, ...DEFINITIONS_SEGMENTS));
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return candidates.find((candidate) => existsSync(candidate));
}

let cache: Map<string, string> | undefined;

/**
 * Read the glossary definitions, memoised because the transformer runs once per page.
 *
 * @returns Term to tooltip-text, in source order.
 */
function loadDefinitions(): Map<string, string> {
  if (cache) return cache;
  cache = new Map();
  const file = findDefinitionsFile();
  if (!file) return cache;
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(DEFINITION_LINE)) {
    const [, term, definition] = match;
    if (term && definition) cache.set(term.trim(), definition.trim());
  }
  return cache;
}

/** Terms ordered longest-first so `Open WebUI` wins over a shorter overlapping term. */
function sortedTerms(definitions: Map<string, string>): string[] {
  return [...definitions.keys()].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/** Regex metacharacters that have to be escaped before terms are joined into an alternation. */
const REGEX_METACHARACTERS = new Set([".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]"]);

/**
 * Build the alternation used to find candidate terms in one pass.
 *
 * @param terms Terms to match, case-sensitively, as MkDocs' `abbr` does.
 */
function buildMatcher(terms: string[]): RegExp | undefined {
  if (terms.length === 0) return undefined;
  const escaped = terms.map((term) =>
    [...term].map((char) => (REGEX_METACHARACTERS.has(char) ? `\\${char}` : char)).join("")
  );
  return new RegExp(`(?<![\\w.-])(${escaped.join("|")})(?![\\w])`, "g");
}

/** Element types whose text is not a candidate for abbreviation. */
const SKIPPED_PARENTS = new Set(["link", "heading", "inlineCode", "abbr"]);

/**
 * Wrap the first occurrence of each known term in a paragraph with an `<abbr>` element.
 *
 * @returns A remark transformer.
 */
export function remarkGlossaryTooltips() {
  return (tree: Parameters<typeof visit>[0]) => {
    const definitions = loadDefinitions();
    if (definitions.size === 0) return;
    const matcher = buildMatcher(sortedTerms(definitions));
    if (!matcher) return;

    visit(tree, "text", (node, index, rawParent) => {
      // `visit`'s parent parameter is the unist parent union; the fields used here are the
      // ones every container node in this tree carries.
      const parent = rawParent as { type: string; children: unknown[] } | undefined;
      if (!parent || typeof index !== "number") return;
      if (SKIPPED_PARENTS.has(parent.type)) return;

      const text = String((node as { value?: string }).value ?? "");
      if (text.length === 0 || !matcher.test(text)) {
        matcher.lastIndex = 0;
        return;
      }
      matcher.lastIndex = 0;

      const children: unknown[] = [];
      let cursor = 0;
      for (const match of text.matchAll(matcher)) {
        const [found, term] = match;
        const definition = definitions.get(term ?? found);
        if (!definition) continue;
        if (match.index > cursor) children.push({ type: "text", value: text.slice(cursor, match.index) });
        children.push({
          type: "mdxJsxTextElement",
          name: "abbr",
          attributes: [{ type: "mdxJsxAttribute", name: "title", value: definition }],
          children: [{ type: "text", value: found }],
          data: { _mdxExplicitJsx: true }
        });
        cursor = match.index + found.length;
      }
      if (children.length === 0) return;
      if (cursor < text.length) children.push({ type: "text", value: text.slice(cursor) });
      parent.children.splice(index, 1, ...children);
    });
  };
}
