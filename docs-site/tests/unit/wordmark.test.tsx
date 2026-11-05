/**
 * Tests for the header wordmark and the repository icon.
 *
 * The wordmark pairs the brand voice with the project name, and the pair is what a reader
 * reads as the site identity, so both lines and the accessible label have to stay in step
 * with `lib/site`.  The missing `className` branch is the header's default render.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RepoIcon, Wordmark } from "../../components/wordmark";
import { BRAND, SITE_NAME } from "../../lib/site";

describe("Wordmark", () => {
  it("renders the brand above the project name", () => {
    render(<Wordmark />);
    expect(screen.getByText(BRAND)).toBeInTheDocument();
    expect(screen.getByText(SITE_NAME)).toBeInTheDocument();
  });

  it("labels the pair for assistive tech with both names", () => {
    render(<Wordmark />);
    expect(screen.getByLabelText(`${BRAND} ${SITE_NAME}`)).toBeInTheDocument();
  });

  it("appends a caller class to the layout classes", () => {
    render(<Wordmark className="ml-4" />);
    const root = screen.getByLabelText(`${BRAND} ${SITE_NAME}`);
    expect(root.className).toContain("flex");
    expect(root.className).toContain("ml-4");
  });

  it("keeps the class list valid with no caller class", () => {
    render(<Wordmark />);
    const root = screen.getByLabelText(`${BRAND} ${SITE_NAME}`);
    expect(root.className.trim()).toBe("flex flex-col leading-none");
  });
});

describe("RepoIcon", () => {
  it("titles the artwork GitHub while keeping it out of the a11y tree", () => {
    const { container } = render(<RepoIcon />);
    const icon = container.querySelector("svg[role='img']");
    expect(icon).not.toBeNull();
    // Decorative: the adjacent link text carries the name, so the icon must not add a
    // second announcement.  It is excluded from the a11y tree, which also means its
    // accessible name computes to "" - the <title> is there for the browser's own tooltip.
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("title")?.textContent).toBe("GitHub");
    expect(icon?.getAttribute("fill")).toBe("currentColor");
  });
});
