import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";

function Thrower({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("render boom");
  return <div>child ok</div>;
}

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Thrower shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("child ok")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("renders custom fallback on error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<div>custom fallback</div>}>
        <Thrower shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText("custom fallback")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("logs caught errors when window is defined", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Thrower shouldThrow />
      </ErrorBoundary>
    );
    expect(spy).toHaveBeenCalledWith("ErrorBoundary caught:", expect.any(Error), expect.any(Object));
    spy.mockRestore();
  });

  it("renders default fallback with retry", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Thrower shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    spy.mockRestore();
  });
});
