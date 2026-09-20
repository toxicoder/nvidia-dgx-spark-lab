/**
 * Two-column page-overview panel rendered from the required markdown pair.
 *
 * `remarkPageOverview` rewrites the first **What's on this page** / **What this enables**
 * lists on a page into these components.  Labels are not headings, so they stay out of
 * the table of contents.
 */

import type { ReactElement, ReactNode } from "react";

/**
 * Mark for one overview column: list lines for contents, a check for enables.
 *
 * @param kind Which column this mark belongs to.
 * @returns An inline SVG, hidden from the accessibility tree because the label text is enough.
 */
function ColumnMark({ kind }: { kind: "contents" | "enables" }): ReactElement {
  if (kind === "contents") {
    return (
      <svg className="page-overview-mark" viewBox="0 0 16 16" width={16} height={16} aria-hidden>
        <path fill="currentColor" d="M2 3.25h12v1.5H2zm0 4h12v1.5H2zm0 4h8v1.5H2z" />
      </svg>
    );
  }
  return (
    <svg className="page-overview-mark" viewBox="0 0 16 16" width={16} height={16} aria-hidden>
      <path fill="currentColor" d="M6.2 12.35 2.4 8.55l1.2-1.2 2.6 2.6 6.2-6.2 1.2 1.2z" />
    </svg>
  );
}

/**
 * Outer grid that holds the contents and enables columns.
 *
 * @param children The two `PageOverviewColumn` elements the remark plugin emits.
 * @returns The overview section.
 */
export function PageOverview({ children }: { children: ReactNode }): ReactElement {
  return (
    <section className="page-overview not-prose" aria-label="Page overview">
      {children}
    </section>
  );
}

/**
 * One column of the overview panel.
 *
 * @param title Label copied from the source strong text.
 * @param kind `contents` (teal) or `enables` (amber).
 * @param children The bullet list that followed that label.
 * @returns The column.
 */
export function PageOverviewColumn({
  title,
  kind,
  children
}: {
  title: string;
  kind: "contents" | "enables";
  children: ReactNode;
}): ReactElement {
  return (
    <div className="page-overview-col" data-kind={kind}>
      <p className="page-overview-label">
        <ColumnMark kind={kind} />
        <span>{title}</span>
      </p>
      {children}
    </div>
  );
}
