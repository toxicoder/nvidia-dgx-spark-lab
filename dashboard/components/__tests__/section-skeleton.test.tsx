import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PageHeaderSkeleton, SectionSkeleton } from "../ui/section-skeleton";

describe("SectionSkeleton", () => {
  it("announces loading to assistive tech", () => {
    render(<SectionSkeleton />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status.textContent).toContain("Loading");
  });

  it("hides the shimmer itself from the accessibility tree", () => {
    render(<SectionSkeleton />);
    const visual = screen.getByTestId("section-skeleton-visual");
    expect(visual).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("status").contains(visual)).toBe(true);
  });

  it("matches the real section frame: header row plus card-shaped blocks", () => {
    render(<SectionSkeleton cards={3} />);
    const visual = screen.getByTestId("section-skeleton-visual");
    expect(visual.querySelectorAll("[data-slot='section-skeleton-card']")).toHaveLength(3);
    expect(visual.querySelector("[data-slot='section-skeleton-header']")).not.toBeNull();
    expect(screen.getByTestId("section-skeleton").className).toContain("rounded-[var(--md-sys-shape-corner-medium)]");
  });

  it("defaults to three cards and accepts a className", () => {
    render(<SectionSkeleton className="mt-4" />);
    expect(screen.getByTestId("section-skeleton").className).toContain("mt-4");
    expect(document.querySelectorAll("[data-slot='section-skeleton-card']")).toHaveLength(3);
  });

  it("renders one header-less block in compact mode, for a KPI grid slot", () => {
    render(<SectionSkeleton compact />);
    const visual = screen.getByTestId("section-skeleton-visual");
    expect(visual.querySelector("[data-slot='section-skeleton-header']")).toBeNull();
    expect(visual.querySelectorAll("[data-slot='section-skeleton-card']")).toHaveLength(1);
    expect(screen.getByTestId("section-skeleton")).toHaveAttribute("data-compact", "true");
  });

  it("renders a decorative page-header block that does not repeat the announcement", () => {
    render(<PageHeaderSkeleton className="mb-2" />);
    const header = screen.getByTestId("page-header-skeleton");
    expect(header).toHaveAttribute("aria-hidden", "true");
    expect(header.className).toContain("mb-2");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
