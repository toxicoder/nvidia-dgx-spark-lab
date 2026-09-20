/**
 * Wrap the first What's on this page / What this enables pair in a page-overview panel.
 *
 * Authors keep writing the bold labels plus bullet lists required by
 * `docs/test_docs_site_render.py`.  This transformer turns only the first root-level
 * occurrence into `<PageOverview>` so the site can render a two-column card; later
 * examples on convention pages stay ordinary markdown.
 */

const ON_PAGE = /^What's on this page$/u;
const ENABLES = /^What this enables(?:\s*\/\s*practical use)?$/u;

/** Loose mdast/JSX node the transformer reads and writes. */
interface Node {
  type: string;
  name?: string;
  value?: string;
  children?: Node[];
  attributes?: { type: string; name: string; value: string }[];
  data?: { _mdxExplicitJsx?: boolean };
}

/**
 * Concatenate descendant text so a strong node's label can be compared as a string.
 *
 * @param node Node whose text to collect.
 * @returns The concatenated text, or an empty string when there is none.
 */
function phrasingText(node: Node | undefined): string {
  if (!node) return "";
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map((child) => phrasingText(child)).join("");
}

/**
 * Return the strong label of a paragraph that contains only that label.
 *
 * Whitespace-only text siblings are ignored so a parse that injects them still matches.
 *
 * @param node Candidate paragraph.
 * @param pattern Allowed label text.
 * @returns The trimmed label, or `undefined` when the node is not a lone matching label.
 */
function labelOf(node: Node | undefined, pattern: RegExp): string | undefined {
  if (!node || node.type !== "paragraph") return undefined;
  const significant = (node.children ?? []).filter((child) => {
    if (child.type === "text" && phrasingText(child).trim().length === 0) return false;
    return true;
  });
  if (significant.length !== 1) return undefined;
  const strong = significant[0];
  if (strong?.type !== "strong") return undefined;
  const text = phrasingText(strong).trim();
  return pattern.test(text) ? text : undefined;
}

/**
 * Whether a node is a markdown list.
 *
 * @param node Candidate node.
 * @returns True when the node is a list.
 */
function isList(node: Node | undefined): boolean {
  return node?.type === "list";
}

/**
 * Build one column of the overview panel.
 *
 * @param kind `contents` or `enables`.
 * @param title Label copied from the source strong text.
 * @param list The bullet list that followed that label.
 * @returns An MDX JSX flow element.
 */
function column(kind: "contents" | "enables", title: string, list: Node): Node {
  return {
    type: "mdxJsxFlowElement",
    name: "PageOverviewColumn",
    attributes: [
      { type: "mdxJsxAttribute", name: "kind", value: kind },
      { type: "mdxJsxAttribute", name: "title", value: title }
    ],
    children: [list],
    data: { _mdxExplicitJsx: true }
  };
}

/**
 * Build the two-column overview element.
 *
 * @param onPageTitle Label of the contents column.
 * @param onPageList Contents list.
 * @param enablesTitle Label of the enables column.
 * @param enablesList Enables list.
 * @returns An MDX JSX flow element.
 */
function panel(onPageTitle: string, onPageList: Node, enablesTitle: string, enablesList: Node): Node {
  return {
    type: "mdxJsxFlowElement",
    name: "PageOverview",
    attributes: [],
    children: [column("contents", onPageTitle, onPageList), column("enables", enablesTitle, enablesList)],
    data: { _mdxExplicitJsx: true }
  };
}

/**
 * Wrap the first root-level overview pair in `<PageOverview>`.
 *
 * Nested copies (inside list items) and later examples on the same page are left
 * untouched.  A missing pair is a no-op so generated reference pages stay as they are.
 *
 * @returns A remark transformer.
 */
export function remarkPageOverview(): (tree: Node) => void {
  return (tree: Node): void => {
    const children = tree.children;
    if (!Array.isArray(children)) return;
    for (let index = 0; index <= children.length - 4; index += 1) {
      const onPageTitle = labelOf(children[index], ON_PAGE);
      const enablesTitle = labelOf(children[index + 2], ENABLES);
      const onPageList = children[index + 1];
      const enablesList = children[index + 3];
      if (!onPageTitle || !enablesTitle || !isList(onPageList) || !isList(enablesList)) continue;
      children.splice(index, 4, panel(onPageTitle, onPageList, enablesTitle, enablesList));
      return;
    }
  };
}
