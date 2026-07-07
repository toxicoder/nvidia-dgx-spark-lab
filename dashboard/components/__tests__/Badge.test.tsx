import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../ui/badge";

/** Fully rendered tests for shadcn Badge (MD3 role variants). */
describe("Badge (shadcn)", () => {
  it("renders default badge", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("supports secondary / outline / destructive (MD3 inspired)", () => {
    render(
      <>
        <Badge variant="secondary">Tonal</Badge>
        <Badge variant="outline">Outlined</Badge>
        <Badge variant="destructive">Error</Badge>
      </>
    );
    expect(screen.getByText("Tonal")).toBeInTheDocument();
    expect(screen.getByText("Outlined")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});
