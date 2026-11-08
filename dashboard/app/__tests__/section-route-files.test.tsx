import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import SectionError from "@/app/(dashboard)/[section]/error";
import SectionLoading from "@/app/(dashboard)/[section]/loading";

describe("section route error boundary", () => {
  const reset = vi.fn<() => void>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("names what failed and shows the error message", () => {
    render(<SectionError error={new Error("kubectl timed out")} reset={reset} />);

    expect(screen.getByTestId("error-state-title")).toHaveTextContent("could not be loaded");
    expect(screen.getByText("kubectl timed out")).toBeInTheDocument();
  });

  it("falls back to a readable sentence when the error has no message", () => {
    render(<SectionError error={new Error("")} reset={reset} />);

    expect(screen.getByText(/unexpected error occurred while reading host state/i)).toBeInTheDocument();
  });

  it("shows the server digest so an operator can quote it", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<SectionError error={error} reset={reset} />);

    expect(screen.getByText(/Digest abc123/)).toBeInTheDocument();
  });

  it("omits the digest line when there is none", () => {
    render(<SectionError error={new Error("boom")} reset={reset} />);

    expect(screen.queryByText(/Digest /)).not.toBeInTheDocument();
  });

  it("reveals the stack in development", () => {
    const error = Object.assign(new Error("boom"), { stack: "at Secret read\n  at host.ts:12" });

    render(<SectionError error={error} reset={reset} />);

    expect(screen.getByTestId("error-state-technical")).toHaveTextContent("host.ts:12");
  });

  it("keeps the stack out of the page in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = Object.assign(new Error("boom"), { stack: "at Secret read\n  at host.ts:12" });

    render(<SectionError error={error} reset={reset} />);

    expect(screen.queryByTestId("error-state-technical")).not.toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("re-runs the segment through reset, and offers a way home", () => {
    render(<SectionError error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(reset).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("link", { name: /back to overview/i })).toHaveAttribute("href", "/");
  });
});

describe("section route loading state", () => {
  it("shows one announced placeholder shaped like the route", () => {
    render(<SectionLoading />);

    expect(screen.getByTestId("page-header-skeleton")).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading");
    expect(screen.getAllByTestId("section-skeleton")).toHaveLength(1);
  });
});
