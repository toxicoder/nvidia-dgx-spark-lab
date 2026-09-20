/**
 * Tests for the page-overview transformer.
 *
 * Hand-written docs open with **What's on this page** / **What this enables** plus
 * a list each.  The site wraps that first pair in `<PageOverview>` so it renders as
 * a two-column panel; later identical examples (project-conventions) and nested
 * copies (CONTRIBUTING authoring rules) have to stay ordinary markdown.
 */

import { describe, expect, it } from "vitest";

import { remarkPageOverview } from "../../lib/remark-page-overview";

/** A node loose enough to inspect: the transformer works on unstructured mdast nodes. */
interface Node {
  type: string;
  name?: string;
  value?: string;
  children?: Node[];
  attributes?: { type?: string; name?: string; value?: string }[];
}

/** Paragraph whose only phrasing is a strong label, matching remark-parse of `**text**`. */
function labelParagraph(text: string): Node {
  return {
    type: "paragraph",
    children: [{ type: "strong", children: [{ type: "text", value: text }] }]
  };
}

/** Unordered list of one-item paragraphs. */
function bulletList(items: string[]): Node {
  return {
    type: "list",
    children: items.map((item) => ({
      type: "listItem",
      children: [{ type: "paragraph", children: [{ type: "text", value: item }] }]
    }))
  };
}

/** The four-node overview pair used on every hand-written page. */
function overviewPair(
  enablesLabel = "What this enables",
  onPage = ["sections"],
  enables = ["benefit"]
): Node[] {
  return [
    labelParagraph("What's on this page"),
    bulletList(onPage),
    labelParagraph(enablesLabel),
    bulletList(enables)
  ];
}

/** Run the transformer over a root of the given children and return that root. */
function apply(children: Node[]): Node {
  const tree: Node = { type: "root", children: children.map((child) => structuredClone(child)) };
  (remarkPageOverview() as (tree: unknown) => void)(tree);
  return tree;
}

/** First root child, which is a PageOverview element after a successful wrap. */
function overview(tree: Node): Node | undefined {
  return tree.children?.[0];
}

describe("remarkPageOverview", () => {
  it("wraps the first What's on this page / What this enables pair", () => {
    const tree = apply([...overviewPair(), { type: "paragraph", children: [{ type: "text", value: "body" }] }]);
    const panel = overview(tree);
    expect(panel?.type).toBe("mdxJsxFlowElement");
    expect(panel?.name).toBe("PageOverview");
    expect(panel?.children).toHaveLength(2);

    const [contents, enables] = panel?.children ?? [];
    expect(contents?.name).toBe("PageOverviewColumn");
    expect(enables?.name).toBe("PageOverviewColumn");
    expect(contents?.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "kind", value: "contents" }),
        expect.objectContaining({ name: "title", value: "What's on this page" })
      ])
    );
    expect(enables?.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "kind", value: "enables" }),
        expect.objectContaining({ name: "title", value: "What this enables" })
      ])
    );
    expect(contents?.children?.[0]?.type).toBe("list");
    expect(enables?.children?.[0]?.type).toBe("list");
    expect(tree.children).toHaveLength(2);
    expect(tree.children?.[1]?.type).toBe("paragraph");
  });

  it("accepts the What this enables / practical use label variant", () => {
    const tree = apply(overviewPair("What this enables / practical use"));
    const enables = overview(tree)?.children?.[1];
    expect(enables?.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "title",
          value: "What this enables / practical use"
        })
      ])
    );
  });

  it("wraps only the first pair when a later example repeats the pattern", () => {
    const tree = apply([
      ...overviewPair("What this enables", ["real page"], ["real benefit"]),
      { type: "heading", children: [{ type: "text", value: "Page structure" }] },
      ...overviewPair("What this enables", ["example bullets"], ["example benefit"])
    ]);
    expect(tree.children).toHaveLength(6);
    expect(tree.children?.[0]?.name).toBe("PageOverview");
    expect(tree.children?.[2]?.type).toBe("paragraph");
    expect(tree.children?.[2]?.children?.[0]?.type).toBe("strong");
    expect(tree.children?.[3]?.type).toBe("list");
  });

  it("leaves a page without the pair untouched", () => {
    const children: Node[] = [
      { type: "heading", children: [{ type: "text", value: "Title" }] },
      { type: "paragraph", children: [{ type: "text", value: "Just prose." }] }
    ];
    const tree = apply(children);
    expect(tree.children?.map((child) => child.type)).toEqual(["heading", "paragraph"]);
  });

  it("does not wrap a label paragraph that has extra prose", () => {
    const tree = apply([
      {
        type: "paragraph",
        children: [
          { type: "strong", children: [{ type: "text", value: "What's on this page" }] },
          { type: "text", value: " / " },
          { type: "strong", children: [{ type: "text", value: "What this enables" }] },
          { type: "text", value: " sections" }
        ]
      },
      bulletList(["not an overview"])
    ]);
    expect(tree.children?.[0]?.type).toBe("paragraph");
    expect(tree.children?.[0]?.name).toBeUndefined();
  });

  it("does not wrap a label that is not followed by a list", () => {
    const tree = apply([
      labelParagraph("What's on this page"),
      { type: "paragraph", children: [{ type: "text", value: "not a list" }] },
      labelParagraph("What this enables"),
      bulletList(["benefit"])
    ]);
    expect(tree.children?.every((child) => child.type !== "mdxJsxFlowElement")).toBe(true);
  });

  it("does not wrap a pair nested inside a list item", () => {
    const tree = apply([
      {
        type: "list",
        children: [
          {
            type: "listItem",
            children: overviewPair()
          }
        ]
      }
    ]);
    expect(tree.children?.[0]?.type).toBe("list");
    expect(tree.children?.[0]?.name).toBeUndefined();
  });

  it("still wraps when widgets sit above the pair", () => {
    const tree = apply([
      { type: "mdxJsxFlowElement", name: "ClusterConfigPanel", children: [] },
      { type: "heading", children: [{ type: "text", value: "Getting Started" }] },
      ...overviewPair()
    ]);
    expect(tree.children?.[0]?.name).toBe("ClusterConfigPanel");
    expect(tree.children?.[2]?.name).toBe("PageOverview");
  });
});
