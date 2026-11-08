import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SectionFailure } from "@/components/SectionFailure";

const refresh = vi.fn<() => void>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh })
}));

describe("SectionFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names the failed section and shows the cause", () => {
    render(<SectionFailure title="Storage" message="docker socket unreachable" />);

    expect(screen.getByTestId("error-state-title")).toHaveTextContent("Storage");
    expect(screen.getByText("docker socket unreachable")).toBeInTheDocument();
  });

  it("re-runs the server render through router.refresh, not a full reload", () => {
    render(<SectionFailure title="Tasks" message="containerd did not answer" />);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
