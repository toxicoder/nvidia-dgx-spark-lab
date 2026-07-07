import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { OpenWebUIPanel } from "@/components/OpenWebUIPanel";
import { fakeOpenWebUIStatus } from "@/lib/mocks/fixtures";

const hostMocks = vi.hoisted(() => ({
  getOpenWebUIStatusAction: vi.fn(),
  startOpenWebUIAction: vi.fn(),
  stopOpenWebUIAction: vi.fn()
}));

const toastMock = vi.fn();

vi.mock("@/actions/host-actions", () => hostMocks);

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock })
}));

describe("OpenWebUIPanel", () => {
  const writeText = vi.fn();
  const stopped = fakeOpenWebUIStatus;
  const running = { ...fakeOpenWebUIStatus, state: "running" as const, helm_installed: true, pod_ready: true };

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    Object.assign(navigator, { clipboard: { writeText } });
    hostMocks.getOpenWebUIStatusAction.mockResolvedValue(stopped);
    hostMocks.startOpenWebUIAction.mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "" });
    hostMocks.stopOpenWebUIAction.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("renders stopped state with deploy button", () => {
    render(<OpenWebUIPanel initialStatus={stopped} />);
    expect(screen.getByText(/Agent Chat \(Open WebUI\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deploy chat UI/i })).toBeInTheDocument();
    expect(screen.getByText(/Prerequisites/)).toBeInTheDocument();
  });

  it("starts Open WebUI stack", async () => {
    hostMocks.getOpenWebUIStatusAction.mockResolvedValue(running);

    render(<OpenWebUIPanel initialStatus={stopped} />);
    fireEvent.click(screen.getByRole("button", { name: /Deploy chat UI/i }));

    await waitFor(() => {
      expect(hostMocks.startOpenWebUIAction).toHaveBeenCalledWith("open-webui-lab", "yes");
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Open WebUI starting" }));
    });
  });

  it("shows error toast when start fails", async () => {
    hostMocks.startOpenWebUIAction.mockResolvedValue({ exitCode: 1, stdout: "", stderr: "helm error" });

    render(<OpenWebUIPanel initialStatus={stopped} />);
    fireEvent.click(screen.getByRole("button", { name: /Deploy chat UI/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Start failed", variant: "error" }));
    });
  });

  it("renders running state with open chat and stop", () => {
    render(<OpenWebUIPanel initialStatus={running} />);
    expect(screen.getByRole("link", { name: /Open chat/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Stop$/i })).toBeInTheDocument();
  });

  it("stops Open WebUI stack", async () => {
    hostMocks.getOpenWebUIStatusAction.mockResolvedValue(stopped);

    render(<OpenWebUIPanel initialStatus={running} />);
    fireEvent.click(screen.getByRole("button", { name: /^Stop$/i }));

    await waitFor(() => {
      expect(hostMocks.stopOpenWebUIAction).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Open WebUI stopped" }));
    });
  });

  it("copies chat URL when running", async () => {
    render(<OpenWebUIPanel initialStatus={running} />);
    fireEvent.click(screen.getByRole("button", { name: /Copy URL/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(running.urls.sso);
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Copied chat URL" }));
    });
  });

  it("shows starting badge and nodeport bypass line", () => {
    const starting = {
      ...running,
      state: "starting" as const,
      urls: { sso: "https://chat.lab.local", nodeport: "http://localhost:32085" }
    };
    render(<OpenWebUIPanel initialStatus={starting} />);
    expect(screen.getByText("starting")).toBeInTheDocument();
    expect(screen.getByText(/bypass:/)).toBeInTheDocument();
  });

  it("toasts when refresh fails on poll", async () => {
    vi.useFakeTimers();
    hostMocks.getOpenWebUIStatusAction.mockRejectedValue(new Error("poll failed"));
    render(<OpenWebUIPanel initialStatus={stopped} />);
    await vi.advanceTimersByTimeAsync(10000);
    await vi.runOnlyPendingTimersAsync();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Open WebUI status failed", variant: "error" })
    );
  });

  it("toasts when copy fails", async () => {
    writeText.mockRejectedValue(new Error("clipboard denied"));
    render(<OpenWebUIPanel initialStatus={running} />);
    fireEvent.click(screen.getByRole("button", { name: /Copy URL/i }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Copy failed", variant: "error" }));
    });
  });

  it("toasts when stop returns non-zero exit", async () => {
    hostMocks.stopOpenWebUIAction.mockResolvedValue({ exitCode: 1, stdout: "", stderr: "helm uninstall failed" });
    render(<OpenWebUIPanel initialStatus={running} />);
    fireEvent.click(screen.getByRole("button", { name: /^Stop$/i }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Stop failed", variant: "error" }));
    });
  });

  it("toasts when stop throws", async () => {
    hostMocks.stopOpenWebUIAction.mockRejectedValue(new Error("network"));
    render(<OpenWebUIPanel initialStatus={running} />);
    fireEvent.click(screen.getByRole("button", { name: /^Stop$/i }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Stop failed", variant: "error" }));
    });
  });

  it("uses nodeport when SSO URL is empty", () => {
    const nodeportOnly = {
      ...stopped,
      urls: { sso: "", nodeport: "http://localhost:32085" }
    };
    render(<OpenWebUIPanel initialStatus={nodeportOnly} />);
    expect(screen.getByText(/http:\/\/localhost:32085/)).toBeInTheDocument();
  });

  it("shows reachable badge when Hermes gateway is up", () => {
    const reachable = {
      ...running,
      backend: { hermes_gateway: { url: "http://gw", reachable: true, endpoint_ip: "10.0.0.1" } }
    };
    render(<OpenWebUIPanel initialStatus={reachable} />);
    expect(screen.getByText("reachable")).toBeInTheDocument();
  });

  it("shows not reachable badge for Hermes gateway", () => {
    const unreachable = {
      ...stopped,
      backend: { hermes_gateway: { url: "http://gw", reachable: false, endpoint_ip: "" } }
    };
    render(<OpenWebUIPanel initialStatus={unreachable} />);
    expect(screen.getByText("not reachable")).toBeInTheDocument();
  });

  it("toasts stdout when start fails without stderr", async () => {
    hostMocks.startOpenWebUIAction.mockResolvedValue({ exitCode: 2, stdout: "stdout only", stderr: "" });
    render(<OpenWebUIPanel initialStatus={stopped} />);
    fireEvent.click(screen.getByRole("button", { name: /Deploy chat UI/i }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Start failed", description: "stdout only", variant: "error" })
      );
    });
  });

  it("toasts stdout when stop fails without stderr", async () => {
    hostMocks.stopOpenWebUIAction.mockResolvedValue({ exitCode: 2, stdout: "stop stdout", stderr: "" });
    render(<OpenWebUIPanel initialStatus={running} />);
    fireEvent.click(screen.getByRole("button", { name: /^Stop$/i }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Stop failed", description: "stop stdout", variant: "error" })
      );
    });
  });

  it("toasts stderr when start returns non-zero exit", async () => {
    hostMocks.startOpenWebUIAction.mockResolvedValue({ exitCode: 2, stdout: "", stderr: "helm failed" });
    render(<OpenWebUIPanel initialStatus={stopped} />);
    fireEvent.click(screen.getByRole("button", { name: /Deploy chat UI/i }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Start failed", description: "helm failed", variant: "error" })
      );
    });
  });

  it("toasts when start throws", async () => {
    hostMocks.startOpenWebUIAction.mockRejectedValue(new Error("denied"));
    render(<OpenWebUIPanel initialStatus={stopped} />);
    fireEvent.click(screen.getByRole("button", { name: /Deploy chat UI/i }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Start failed", variant: "error" }));
    });
  });
});
