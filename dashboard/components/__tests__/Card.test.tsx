import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../ui/card";

/** Fully rendered tests for canonical shadcn Card + subs. */
describe("Card (shadcn primitives)", () => {
  it("renders Card with header, title, content, footer", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Panel Title</CardTitle>
        </CardHeader>
        <CardContent>Body content here</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );

    expect(screen.getByText("Panel Title")).toBeInTheDocument();
    expect(screen.getByText("Body content here")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("accepts className and renders surface styles", () => {
    const { container } = render(<Card className="custom">Surface</Card>);
    expect(screen.getByText("Surface")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("custom");
    expect(container.firstChild).toHaveClass("bg-[var(--md-sys-color-surface)]");
  });
});
