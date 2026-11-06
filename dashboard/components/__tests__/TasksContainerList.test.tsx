import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TasksContainerList } from "../TasksContainerList";
import { fakeContainers } from "@/lib/mocks/fixtures";

const stopContainerAction = vi.fn<(id: string) => Promise<{ stopped: string }>>();
const refresh = vi.fn();
const toastMock = vi.fn();

/** First element of a testing-library query; fails the test when the query matched nothing. */
function first<T>(items: T[]): T {
  const [firstItem] = items;
  if (firstItem === undefined) throw new Error("expected at least one matching element");
  return firstItem;
}

vi.mock("@/actions/host-actions", () => ({
  stopContainerAction: (id: string) => stopContainerAction(id)
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock })
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/"
}));

describe("TasksContainerList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopContainerAction.mockResolvedValue({ stopped: "abc123" });
  });

  it("shows confirmation dialog before stopping a container", async () => {
    render(<TasksContainerList data={fakeContainers} />);

    expect(screen.queryByText(/Stop container\?/i)).not.toBeInTheDocument();

    const stopButtons = screen.getAllByRole("button", { name: /stop/i });
    fireEvent.click(first(stopButtons));

    expect(screen.getByText(/Stop container\?/i)).toBeInTheDocument();
    expect(screen.getByText(/This will stop kimi-test/i)).toBeInTheDocument();
    expect(stopContainerAction).not.toHaveBeenCalled();
  });

  it("calls stop action only after confirming", async () => {
    render(<TasksContainerList data={fakeContainers} />);

    fireEvent.click(first(screen.getAllByRole("button", { name: /stop/i })));
    fireEvent.click(screen.getByRole("button", { name: /Stop container/i }));

    await waitFor(() => {
      expect(stopContainerAction).toHaveBeenCalledWith("abc123");
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("does not stop when confirmation is cancelled", async () => {
    render(<TasksContainerList data={fakeContainers} />);

    fireEvent.click(first(screen.getAllByRole("button", { name: /stop/i })));
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(stopContainerAction).not.toHaveBeenCalled();
    expect(screen.queryByText(/Stop container\?/i)).not.toBeInTheDocument();
  });

  it("renders full status when first token is empty", () => {
    render(<TasksContainerList data={[{ ID: "zzz", Names: "anon", Status: "   ", Image: "img" }]} />);
    const badge = screen.getByTestId("ui-badge");
    expect(badge).toHaveAttribute("title", "   ");
  });

  it("uses container id as display name when Names missing", () => {
    render(<TasksContainerList data={[{ ID: "container-id", Names: "", Status: "Up", Image: "img" }]} />);
    expect(screen.getByText("container-id")).toBeInTheDocument();
  });

  it("uses row index key when container id missing", () => {
    render(<TasksContainerList data={[{ ID: "", Names: "anon", Status: "Up", Image: "img" }]} />);
    expect(screen.getByText("anon")).toBeInTheDocument();
  });

  it("renders unknown status when container status missing", () => {
    render(<TasksContainerList data={[{ ID: "zzz", Names: "anon", Status: "", Image: "img" }]} />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });

  it("renders docker error state", () => {
    render(<TasksContainerList data={{ error: "docker unavailable (mock)" }} />);
    expect(screen.getByText(/docker unavailable/i)).toBeInTheDocument();
  });

  it("toasts error when stop fails", async () => {
    stopContainerAction.mockRejectedValue(new Error("docker down"));

    render(<TasksContainerList data={fakeContainers} />);
    fireEvent.click(first(screen.getAllByRole("button", { name: /stop/i })));
    fireEvent.click(screen.getByRole("button", { name: /Stop container/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Failed to stop", variant: "error" }));
    });
  });
});
