import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UtilityOutput } from "../UtilityOutput";

describe("UtilityOutput", () => {
  it("renders run result with exit code, stdout and stderr", () => {
    render(
      <UtilityOutput
        result={{
          exitCode: 1,
          stdout: "hello stdout",
          stderr: "something failed"
        }}
      />
    );

    expect(screen.getByText("Exit code")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("hello stdout")).toBeInTheDocument();
    expect(screen.getByText("something failed")).toBeInTheDocument();
  });

  it("renders status-only utility output", () => {
    render(<UtilityOutput result={{ status: "running" }} />);

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.queryByText("Exit code")).not.toBeInTheDocument();
  });

  it("shows success badge for exit code 0", () => {
    render(<UtilityOutput result={{ exitCode: 0, stdout: "ok", stderr: "" }} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
