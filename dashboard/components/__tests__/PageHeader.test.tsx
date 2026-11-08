import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PageHeader } from "@/components/PageHeader";

describe("PageHeader", () => {
  it("renders the page's single h1 and no stray heading levels", () => {
    render(<PageHeader title="Resource Guard" />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Resource Guard");
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("omits the description paragraph when none is supplied", () => {
    const { container } = render(<PageHeader title="Storage" />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(container.querySelector("header p")).toBeNull();
  });

  it("shows a description when one is supplied", () => {
    render(<PageHeader title="Storage" description="Host model cache under /mnt/models" />);

    expect(screen.getByText("Host model cache under /mnt/models")).toBeInTheDocument();
  });

  it("renders trailing actions when supplied", () => {
    render(<PageHeader title="Tasks" actions={<button type="button">Refresh</button>} />);

    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("omits the actions container entirely when none is supplied", () => {
    const { container } = render(<PageHeader title="Tasks" />);

    expect(container.querySelectorAll("header > div")).toHaveLength(1);
  });

  it("adds a second container when actions are supplied", () => {
    const { container } = render(<PageHeader title="Tasks" actions={<button type="button">Refresh</button>} />);

    expect(container.querySelectorAll("header > div")).toHaveLength(2);
  });

  it("applies a caller's extra classes to the header element", () => {
    const { container } = render(<PageHeader title="System" className="pb-0" />);

    expect(container.querySelector("header")).toHaveClass("pb-0");
  });
});
