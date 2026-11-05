/**
 * Tests for the glossary tooltip transformer.
 *
 * The MkDocs site auto-appended `docs/includes/abbreviations.md` and wrapped each known
 * term in a tooltip.  The port has to keep doing that, and it has to keep working when the
 * compiler's working directory is the docs package rather than the repository — which is
 * the case that silently produced zero tooltips once.
 *
 * A tooltip must also never corrupt the sentence around it: the term is spliced in as a JSX
 * element with the surrounding prose kept as plain text, terms already inside a heading, a
 * link, inline code, or an existing tooltip are left alone, and a match the definitions do
 * not actually define is dropped rather than rendered as an empty tooltip.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { remarkGlossaryTooltips } from "../../lib/remark-glossary";

/** A node loose enough to inspect: the transformer works on unstructured mdast nodes. */
interface Node {
  type: string;
  name?: string;
  value?: string;
  children?: Node[];
  attributes?: { type?: string; name: string; value: string }[];
}

/** Build a root holding one paragraph of the given text and run the transformer over it. */
function applyTo(text: string, parentType = "paragraph"): Node {
  const tree: Node = {
    type: "root",
    children: [{ type: parentType, children: [{ type: "text", value: text }] }]
  };
  (remarkGlossaryTooltips() as (tree: unknown) => void)(tree);
  return tree;
}

const childrenOf = (node: Node, index = 0) => node.children?.[index]?.children ?? [];

/** Path suffix the plugin hunts for below each candidate root. */
const DEFINITIONS_SUFFIX = "docs/includes/abbreviations.md";

/**
 * Load a fresh copy of the plugin reading a glossary that is not the shipped one.
 *
 * The plugin memoises its definitions per module instance, so the module is re-imported with
 * `node:fs` replaced.  Passing `undefined` for `content` stands in for the plugin running
 * outside a checkout, where none of the candidate paths hold the file; a string is the file's
 * contents.  This is how the guards for terms the shipped `docs/includes/abbreviations.md`
 * does not contain (a regex metacharacter in a term, say) are exercised without editing the
 * file every page depends on.
 */
async function loadPluginWithDefinitions(content: string | undefined): Promise<() => (tree: unknown) => void> {
  vi.resetModules();
  vi.doMock("node:fs", () => {
    const stub = {
      existsSync: (candidate: unknown) => content !== undefined && String(candidate).endsWith(DEFINITIONS_SUFFIX),
      readFileSync: () => content ?? ""
    };
    return { ...stub, default: stub };
  });
  const module = await import("../../lib/remark-glossary");
  return module.remarkGlossaryTooltips as () => (tree: unknown) => void;
}

/** Collect every node with the given JSX name, including nested ones. */
function collectNamed(node: Node | undefined, name: string): Node[] {
  const found: Node[] = [];
  const walk = (current: Node | undefined) => {
    if (!current) return;
    if (current.name === name) found.push(current);
    for (const child of current.children ?? []) walk(child);
  };
  walk(node);
  return found;
}

describe("remarkGlossaryTooltips", () => {
  it("finds the shared abbreviations file when run from the docs package", () => {
    const children = childrenOf(applyTo("The K3s control plane and NCCL interconnect matter here."));
    expect(children.filter((child) => child.type === "mdxJsxTextElement").length).toBeGreaterThan(0);
  });

  it("wraps a known term with its tooltip text", () => {
    const children = childrenOf(applyTo("PVC storage is provisioned per workload."));
    const term = children.find((child) => child.name === "GlossaryTerm");
    expect(term?.type).toBe("mdxJsxTextElement");
    expect(term?.attributes?.[0]?.name).toBe("title");
    expect(term?.attributes?.[0]?.value).toMatch(/PersistentVolumeClaim/u);
  });

  it("leaves unknown terms untouched", () => {
    const children = childrenOf(applyTo("Nothing exotic zzznotaterm here at all."));
    expect(children.every((child) => child.type === "text")).toBe(true);
  });

  it("does not touch text inside a heading", () => {
    const children = childrenOf(applyTo("K3s and NCCL", "heading"));
    expect(children.every((child) => child.type === "text")).toBe(true);
  });

  it("wraps a known term only once", () => {
    const terms = collectNamed(applyTo("The K3s control plane."), "GlossaryTerm");
    expect(terms).toHaveLength(1);
    expect(terms[0]?.children?.every((child) => child.type === "text")).toBe(true);
  });

  it("does not wrap text already inside an abbr element", () => {
    const tree: Node = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "mdxJsxTextElement",
              name: "abbr",
              attributes: [{ type: "mdxJsxAttribute", name: "title", value: "already defined" }],
              children: [{ type: "text", value: "K3s" }]
            }
          ]
        }
      ]
    };
    (remarkGlossaryTooltips() as (tree: unknown) => void)(tree);
    const abbrs = collectNamed(tree, "abbr");
    expect(abbrs).toHaveLength(1);
    expect(abbrs[0]?.attributes?.[0]?.value).toBe("already defined");
  });

  it("does not wrap text already inside a GlossaryTerm element", () => {
    const tree: Node = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "mdxJsxTextElement",
              name: "GlossaryTerm",
              attributes: [{ type: "mdxJsxAttribute", name: "title", value: "written by hand" }],
              children: [{ type: "text", value: "K3s" }]
            }
          ]
        }
      ]
    };
    (remarkGlossaryTooltips() as (tree: unknown) => void)(tree);
    const terms = collectNamed(tree, "GlossaryTerm");
    expect(terms).toHaveLength(1);
    expect(terms[0]?.attributes?.[0]?.value).toBe("written by hand");
  });

  it("does not abbreviate inside inline code", () => {
    const children = childrenOf(applyTo("Run the K3s binary with NCCL set.", "inlineCode"));
    expect(children.every((child) => child.type === "text")).toBe(true);
  });

  it("does not abbreviate inside a link", () => {
    const children = childrenOf(applyTo("See the K3s docs for NCCL.", "link"));
    expect(children.every((child) => child.type === "text")).toBe(true);
  });

  it("keeps the prose around a term as its own text nodes", () => {
    const children = childrenOf(applyTo("Use PVC storage per workload."));
    expect(children.map((child) => child.type)).toEqual(["text", "mdxJsxTextElement", "text"]);
    expect(children[0]?.value).toBe("Use ");
    expect(children[1]?.children?.[0]?.value).toBe("PVC");
    expect(children[2]?.value).toBe(" storage per workload.");
  });

  it("omits the trailing text node when a term ends the line", () => {
    const children = childrenOf(applyTo("Storage is on PVC"));
    expect(children.map((child) => child.type)).toEqual(["text", "mdxJsxTextElement"]);
    expect(children[1]?.attributes?.[0]?.value).toMatch(/PersistentVolumeClaim/u);
  });

  it("leaves an empty text node alone", () => {
    const children = childrenOf(applyTo(""));
    expect(children).toEqual([{ type: "text", value: "" }]);
  });

  it("leaves a text node that carries no value alone", () => {
    const tree: Node = { type: "root", children: [{ type: "paragraph", children: [{ type: "text" }] }] };
    (remarkGlossaryTooltips() as (tree: unknown) => void)(tree);
    expect(tree.children?.[0]?.children).toEqual([{ type: "text" }]);
  });

  it("leaves a text node that has no parent to splice into alone", () => {
    const tree: Node = { type: "text", value: "The K3s control plane matters." };
    expect(() => (remarkGlossaryTooltips() as (tree: unknown) => void)(tree)).not.toThrow();
    expect(tree.children).toBeUndefined();
  });
});

describe("remarkGlossaryTooltips against a stubbed glossary file", () => {
  afterEach(() => {
    vi.doUnmock("node:fs");
    vi.resetModules();
  });

  it("leaves the page plain when no candidate path holds the definitions file", async () => {
    const plugin = await loadPluginWithDefinitions(undefined);
    const tree: Node = {
      type: "root",
      children: [{ type: "paragraph", children: [{ type: "text", value: "The K3s control plane needs NCCL." }] }]
    };
    (plugin() as (tree: unknown) => void)(tree);
    expect(tree.children?.[0]?.children).toEqual([{ type: "text", value: "The K3s control plane needs NCCL." }]);
  });

  it("matches a term that contains regex metacharacters literally", async () => {
    const plugin = await loadPluginWithDefinitions("*[Node.js]: A JavaScript runtime.\n");
    const tree: Node = {
      type: "root",
      children: [{ type: "paragraph", children: [{ type: "text", value: "Install Node.js, never NodeXjs." }] }]
    };
    (plugin() as (tree: unknown) => void)(tree);
    const terms = collectNamed(tree, "GlossaryTerm");
    expect(terms).toHaveLength(1);
    expect(terms[0]?.children?.[0]?.value).toBe("Node.js");
    expect(terms[0]?.attributes?.[0]?.value).toBe("A JavaScript runtime.");
  });

  it("drops a match the definitions do not actually define", async () => {
    const plugin = await loadPluginWithDefinitions("*[W\\ild]: A descriptor the matcher over-matches.\n");
    const tree: Node = {
      type: "root",
      children: [{ type: "paragraph", children: [{ type: "text", value: "A Wild animal runs." }] }]
    };
    (plugin() as (tree: unknown) => void)(tree);
    expect(collectNamed(tree, "GlossaryTerm")).toHaveLength(0);
    expect(tree.children?.[0]?.children).toEqual([{ type: "text", value: "A Wild animal runs." }]);
  });
});
