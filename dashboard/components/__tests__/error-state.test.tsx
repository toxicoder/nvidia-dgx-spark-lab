import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ErrorState } from "../ui/error-state";

describe("ErrorState", () => {
  it("announces itself as an alert", () => {
    render(<ErrorState message="Resource Guard unavailable" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Resource Guard unavailable")).toBeInTheDocument();
  });

  it("keeps the raw detail available without shouting it", () => {
    render(<ErrorState message="Capacity check failed" detail="exit 127: inference-workloads.sh not found" />);
    const detail = screen.getByTestId("error-state-detail");
    expect(detail.tagName).toBe("DETAILS");
    expect(detail.textContent).toContain("exit 127");
  });

  it("omits the detail block when there is none", () => {
    render(<ErrorState message="Boom" />);
    expect(screen.queryByTestId("error-state-detail")).not.toBeInTheDocument();
  });

  it("offers a retry that calls back", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Timeout" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the retry when the caller cannot retry", () => {
    render(<ErrorState message="Timeout" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("honours a custom retry label and className", () => {
    render(<ErrorState message="Timeout" onRetry={vi.fn()} retryLabel="Reload" className="mt-4" />);
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByRole("alert").className).toContain("mt-4");
  });
});
