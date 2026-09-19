// source.config.ts
import { defineConfig } from "fumadocs-mdx/config";
import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";

// lib/remark-glossary.ts
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { visit } from "unist-util-visit";
var DEFINITIONS_SEGMENTS = ["docs", "includes", "abbreviations.md"];
var DEFINITION_LINE = /^\*\[(.+?)]:\s*(.+)$/gm;
function findDefinitionsFile() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [];
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
var cache;
function loadDefinitions() {
  if (cache) return cache;
  cache = /* @__PURE__ */ new Map();
  const file = findDefinitionsFile();
  if (!file) return cache;
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(DEFINITION_LINE)) {
    const [, term, definition] = match;
    if (term && definition) cache.set(term.trim(), definition.trim());
  }
  return cache;
}
function sortedTerms(definitions) {
  return [...definitions.keys()].sort((a, b) => b.length - a.length || a.localeCompare(b));
}
var REGEX_METACHARACTERS = /* @__PURE__ */ new Set([".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]"]);
function buildMatcher(terms) {
  if (terms.length === 0) return void 0;
  const escaped = terms.map(
    (term) => [...term].map((char) => REGEX_METACHARACTERS.has(char) ? `\\${char}` : char).join("")
  );
  return new RegExp(`(?<![\\w.-])(${escaped.join("|")})(?![\\w])`, "g");
}
var SKIPPED_PARENTS = /* @__PURE__ */ new Set(["link", "heading", "inlineCode", "abbr"]);
function remarkGlossaryTooltips() {
  return (tree) => {
    const definitions = loadDefinitions();
    if (definitions.size === 0) return;
    const matcher = buildMatcher(sortedTerms(definitions));
    if (!matcher) return;
    visit(tree, "text", (node, index, rawParent) => {
      const parent = rawParent;
      if (!parent || typeof index !== "number") return;
      if (SKIPPED_PARENTS.has(parent.type)) return;
      const text = String(node.value ?? "");
      if (text.length === 0 || !matcher.test(text)) {
        matcher.lastIndex = 0;
        return;
      }
      matcher.lastIndex = 0;
      const children = [];
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

// source.config.ts
var source_config_default = defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMdxMermaid, remarkGlossaryTooltips]
  }
});
export {
  source_config_default as default
};
