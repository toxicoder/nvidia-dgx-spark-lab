/**
 * Tests for the page-overview panel that `remarkPageOverview` emits.
 *
 * The panel is the two-column "What's on this page" / "What this enables" block the lab
 * docs use on their index pages.  Its contract is the shape the stylesheet keys off - the
 * `page-overview*` class names, the `data-kind` hook that colours a column teal or amber,
 * and an accessible section label - plus the two column marks, which are decoration and
 * must stay out of the accessibility tree because the label text already says it.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageOverview, PageOverviewColumn } from "../../components/page-overview";

describe("PageOverview", () => {
  it("labels the section for assistive tech and keeps the grid class", () => {
    render(
      <PageOverview>
        <p>contents</p>
      </PageOverview>
    );
    const section = screen.getByRole("region", { name: "Page overview" });
    expect(section).toBeInTheDocument();
    expect(section.className).toContain("page-overview");
    // `not-prose` stops the MDX typography rules from re-spacing the panel.
    expect(section.className).toContain("not-prose");
  });

  it("renders the children it is handed", () => {
    render(
      <PageOverview>
        <p>first column</p>
        <p>second column</p>
      </PageOverview>
    );
    expect(screen.getByText("first column")).toBeInTheDocument();
    expect(screen.getByText("second column")).toBeInTheDocument();
  });
});

describe("PageOverviewColumn", () => {
  it("carries the kind on data-kind so the stylesheet can colour the column", () => {
    const { rerender } = render(
      <PageOverviewColumn title="What's on this page" kind="contents">
        <ul>
          <li>Item</li>
        </ul>
      </PageOverviewColumn>
    );
    expect(screen.getByText("What's on this page")).toBeInTheDocument();
    expect(screen.getByText("Item")).toBeInTheDocument();

    rerender(
      <PageOverviewColumn title="What this enables" kind="enables">
        <ul>
          <li>Capability</li>
        </ul>
      </PageOverviewColumn>
    );
    const column = screen.getByText("Capability").closest(".page-overview-col");
    expect(column?.getAttribute("data-kind")).toBe("enables");
  });

  it("renders the contents mark as a decorative list glyph", () => {
    const { container } = render(
      <PageOverviewColumn title="Contents" kind="contents">
        <ul>
          <li>Item</li>
        </ul>
      </PageOverviewColumn>
    );
    const mark = container.querySelector("svg.page-overview-mark");
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    expect(mark?.querySelector("path")?.getAttribute("d")).toContain("M2 3.25h12v1.5H2z");
    // The label lives in real text, not in the artwork.
    expect(screen.getByText("Contents")).toBeInTheDocument();
  });

  it("renders the enables mark as a decorative check", () => {
    const { container } = render(
      <PageOverviewColumn title="Enables" kind="enables">
        <ul>
          <li>Capability</li>
        </ul>
      </PageOverviewColumn>
    );
    const mark = container.querySelector("svg.page-overview-mark");
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    expect(mark?.querySelector("path")?.getAttribute("d")).toContain("6.2 12.35");
  });

  it("pairs the mark and the title inside one label paragraph", () => {
    const { container } = render(
      <PageOverviewColumn title="Enables" kind="enables">
        <ul>
          <li>Capability</li>
        </ul>
      </PageOverviewColumn>
    );
    const label = container.querySelector("p.page-overview-label");
    expect(label).not.toBeNull();
    expect(label?.querySelector("svg.page-overview-mark")).not.toBeNull();
    expect(label?.querySelector("span")?.textContent).toBe("Enables");
  });
});
