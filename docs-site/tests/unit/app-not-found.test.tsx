/**
 * Contract for the exported 404 document.
 *
 * `output: "export"` has no server, and GitHub Pages answers an unknown URL with this
 * document, so it is the landing page for every stale deep link a reader may follow from
 * an old bookmark, a CI job summary or a chat paste.  Two things have to hold: the reader
 * is told plainly that the address is not part of the docs (rather than staring at a blank
 * chrome), and there is one obvious way back to the overview.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound, { metadata } from "../../app/not-found";

describe("NotFound", () => {
  it("says out loud that the address is not part of the docs", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
  });

  it("points the reader at search and the overview instead of a dead end", () => {
    render(<NotFound />);
    const copy = screen.getByRole("paragraph");
    expect(copy.textContent).toMatch(/search/i);
    expect(copy.textContent).toMatch(/overview/i);
  });

  it("routes the way back through the site root, not a relative path", () => {
    render(<NotFound />);
    const back = screen.getByRole("link", { name: "overview" });
    expect(back).toHaveAttribute("href", "/");
    expect(back).toHaveClass("underline");
  });

  it("carries the published base path on an alias deploy", () => {
    // next.config.ts feeds Next's basePath from DOCS_ALIAS, and Next applies that prefix to
    // next/link but not to a plain anchor. Without the prefix here the 404 sends the reader to
    // the Pages origin root, off the deployed site entirely.
    const previous = process.env.DOCS_ALIAS;
    process.env.DOCS_ALIAS = "latest";
    try {
      render(<NotFound />);
      expect(screen.getByRole("link", { name: "overview" })).toHaveAttribute(
        "href",
        "/nvidia-dgx-spark-lab/latest/"
      );
    } finally {
      if (previous === undefined) {
        delete process.env.DOCS_ALIAS;
      } else {
        process.env.DOCS_ALIAS = previous;
      }
    }
  });
});

describe("not-found metadata", () => {
  it("titles the 404 document so a dead tab is recognisable", () => {
    expect(metadata.title).toBe("Page not found");
  });
});
