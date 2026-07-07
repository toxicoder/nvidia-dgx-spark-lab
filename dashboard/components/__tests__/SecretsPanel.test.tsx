import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { SecretsPanel } from "../SecretsPanel";
import { fakeSecrets } from "@/lib/mocks/fixtures";

const secretMocks = vi.hoisted(() => ({
  createSecretAction: vi.fn(),
  updateSecretValueAction: vi.fn(),
  deleteSecretAction: vi.fn(),
  revealSecretAction: vi.fn(),
  syncSecretToK8sAction: vi.fn()
}));

const toastMock = vi.fn();

const selectMocks = vi.hoisted(() => ({
  handlers: [] as Array<(v: string) => void>
}));

vi.mock("@/components/ui/select", () => {
  const React = require("react");
  return {
    Select: ({
      children,
      onValueChange,
      value
    }: {
      children: React.ReactNode;
      onValueChange?: (v: string) => void;
      value?: string;
    }) => {
      if (onValueChange) selectMocks.handlers.push(onValueChange);
      return (
        <div data-testid={`mock-select-${value ?? "none"}`}>
          {children}
          {onValueChange ? (
            <>
              <button type="button" data-testid="select-fire-token" onClick={() => onValueChange("token")}>
                token
              </button>
              <button type="button" data-testid="select-fire-dev" onClick={() => onValueChange("dev")}>
                dev
              </button>
            </>
          ) : null}
        </div>
      );
    },
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: () => <span>Select</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value: itemValue }: { children: React.ReactNode; value: string }) => (
      <div data-value={itemValue}>{children}</div>
    )
  };
});

vi.mock("@/actions/secrets-actions", () => secretMocks);

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock })
}));

describe("SecretsPanel", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    selectMocks.handlers.length = 0;
    Object.assign(navigator, { clipboard: { writeText } });
    secretMocks.createSecretAction.mockResolvedValue({
      meta: {
        id: "new-id",
        name: "new-secret",
        category: "api_key" as const,
        description: null,
        valueHint: "hint",
        k8sSync: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: "admin@lab.local"
      }
    });
    secretMocks.updateSecretValueAction.mockResolvedValue({
      meta: { ...fakeSecrets[0], valueHint: "newh", updatedAt: Date.now() }
    });
    secretMocks.revealSecretAction.mockResolvedValue("revealed-plaintext");
    secretMocks.deleteSecretAction.mockResolvedValue(undefined);
    secretMocks.syncSecretToK8sAction.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders secret metadata without values", () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    expect(screen.getByTestId("secrets-panel")).toBeInTheDocument();
    expect(screen.getByText("hf-token")).toBeInTheDocument();
    expect(screen.getByText("openai-key")).toBeInTheDocument();
    expect(screen.queryByText(/hf_/)).not.toBeInTheDocument();
    expect(screen.getByText(/ai-inference\/lab-hf-token/)).toBeInTheDocument();
  });

  it("shows empty state when no secrets", () => {
    render(<SecretsPanel initialSecrets={[]} />);
    expect(screen.getByText(/No secrets stored yet/)).toBeInTheDocument();
  });

  it("creates a secret via add dialog", async () => {
    render(<SecretsPanel initialSecrets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Add secret/i }));

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "new-secret" } });
    fireEvent.change(screen.getByLabelText(/^Value$/i), { target: { value: "secret-value" } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: "desc" } });
    fireEvent.click(screen.getByRole("button", { name: /Save encrypted/i }));

    await waitFor(() => {
      expect(secretMocks.createSecretAction).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "new-secret",
          value: "secret-value",
          description: "desc"
        })
      );
      expect(screen.getByText("new-secret")).toBeInTheDocument();
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Secret saved" }));
    });
  });

  it("omits k8s sync when sync fields are incomplete", async () => {
    render(<SecretsPanel initialSecrets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Add secret/i }));
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "partial-sync" } });
    fireEvent.change(screen.getByLabelText(/^Value$/i), { target: { value: "v" } });
    fireEvent.click(screen.getByLabelText(/Sync to Kubernetes Secret/i));
    fireEvent.click(screen.getByRole("button", { name: /Save encrypted/i }));

    await waitFor(() => {
      expect(secretMocks.createSecretAction).toHaveBeenCalledWith(
        expect.objectContaining({ name: "partial-sync", k8sSync: undefined })
      );
    });
  });

  it("creates secret with k8s sync enabled", async () => {
    render(<SecretsPanel initialSecrets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Add secret/i }));

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "synced" } });
    fireEvent.change(screen.getByLabelText(/^Value$/i), { target: { value: "v" } });
    fireEvent.click(screen.getByLabelText(/Sync to Kubernetes Secret/i));
    fireEvent.change(screen.getByPlaceholderText("secret name"), { target: { value: "lab-sync" } });
    fireEvent.change(screen.getByPlaceholderText("KEY"), { target: { value: "TOKEN" } });
    fireEvent.click(screen.getByRole("button", { name: /Save encrypted/i }));

    await waitFor(() => {
      expect(secretMocks.createSecretAction).toHaveBeenCalledWith(
        expect.objectContaining({
          k8sSync: expect.objectContaining({
            namespace: "ai-inference",
            secretName: "lab-sync",
            key: "TOKEN"
          })
        })
      );
    });
  });

  it("toasts sync error on create when k8s sync fails", async () => {
    secretMocks.createSecretAction.mockResolvedValue({
      meta: {
        id: "x",
        name: "x",
        category: "api_key" as const,
        description: null,
        valueHint: "xx",
        k8sSync: null,
        createdAt: 1,
        updatedAt: 1,
        createdBy: "a"
      },
      syncError: "cluster unreachable"
    });

    render(<SecretsPanel initialSecrets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Add secret/i }));
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText(/^Value$/i), { target: { value: "v" } });
    fireEvent.click(screen.getByRole("button", { name: /Save encrypted/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", description: expect.stringContaining("cluster unreachable") })
      );
    });
  });

  it("toasts error when create fails", async () => {
    secretMocks.createSecretAction.mockRejectedValue(new Error("db down"));
    render(<SecretsPanel initialSecrets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Add secret/i }));
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText(/^Value$/i), { target: { value: "v" } });
    fireEvent.click(screen.getByRole("button", { name: /Save encrypted/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to save secret", variant: "error" })
      );
    });
  });

  it("cancels add dialog", () => {
    render(<SecretsPanel initialSecrets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Add secret/i }));
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.queryByText(/Add secret/i, { selector: "h2" })).not.toBeInTheDocument();
  });

  it("updates secret value", async () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Update value"));

    fireEvent.change(screen.getByDisplayValue(""), { target: { value: "rotated" } });
    fireEvent.click(screen.getByRole("button", { name: /Replace value/i }));

    await waitFor(() => {
      expect(secretMocks.updateSecretValueAction).toHaveBeenCalledWith({
        id: fakeSecrets[0].id,
        value: "rotated"
      });
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Value updated" }));
    });
  });

  it("toasts sync error on update", async () => {
    secretMocks.updateSecretValueAction.mockResolvedValue({
      meta: fakeSecrets[0],
      syncError: "sync failed"
    });
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Update value"));
    fireEvent.change(screen.getByDisplayValue(""), { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: /Replace value/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    });
  });

  it("toasts error when update fails", async () => {
    secretMocks.updateSecretValueAction.mockRejectedValue(new Error("fail"));
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Update value"));
    fireEvent.change(screen.getByDisplayValue(""), { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: /Replace value/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Update failed" }));
    });
  });

  it("reveals secret after typing REVEAL", async () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Reveal value"));

    fireEvent.change(screen.getByPlaceholderText("REVEAL"), { target: { value: "REVEAL" } });
    fireEvent.click(screen.getByRole("button", { name: /^Reveal$/i }));

    await waitFor(() => {
      expect(secretMocks.revealSecretAction).toHaveBeenCalled();
      expect(screen.getByText("revealed-plaintext")).toBeInTheDocument();
    });
  });

  it("copies revealed value to clipboard", async () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Reveal value"));
    fireEvent.change(screen.getByPlaceholderText("REVEAL"), { target: { value: "REVEAL" } });
    fireEvent.click(screen.getByRole("button", { name: /^Reveal$/i }));

    await waitFor(() => screen.getByText("revealed-plaintext"));
    fireEvent.click(screen.getByRole("button", { name: /Copy to clipboard/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("revealed-plaintext");
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Copied to clipboard" }));
    });
  });

  it("toasts copy failure", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Reveal value"));
    fireEvent.change(screen.getByPlaceholderText("REVEAL"), { target: { value: "REVEAL" } });
    fireEvent.click(screen.getByRole("button", { name: /^Reveal$/i }));

    await waitFor(() => screen.getByText("revealed-plaintext"));
    fireEvent.click(screen.getByRole("button", { name: /Copy to clipboard/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Copy failed" }));
    });
  });

  it("clears clipboard after reveal timeout", async () => {
    vi.useFakeTimers();
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Reveal value"));
    fireEvent.change(screen.getByPlaceholderText("REVEAL"), { target: { value: "REVEAL" } });
    fireEvent.click(screen.getByRole("button", { name: /^Reveal$/i }));

    await vi.runOnlyPendingTimersAsync();
    vi.advanceTimersByTime(30000);
    expect(writeText).toHaveBeenCalledWith("");
  });

  it("toasts error when reveal fails", async () => {
    secretMocks.revealSecretAction.mockRejectedValue(new Error("denied"));
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Reveal value"));
    fireEvent.change(screen.getByPlaceholderText("REVEAL"), { target: { value: "REVEAL" } });
    fireEvent.click(screen.getByRole("button", { name: /^Reveal$/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Reveal failed" }));
    });
  });

  it("deletes secret after typing DELETE", async () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("openai-key").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Delete"));

    fireEvent.change(screen.getByPlaceholderText("DELETE"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/i }));

    await waitFor(() => {
      expect(secretMocks.deleteSecretAction).toHaveBeenCalled();
      expect(screen.queryByText("openai-key")).not.toBeInTheDocument();
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Secret deleted" }));
    });
  });

  it("toasts error when delete fails", async () => {
    secretMocks.deleteSecretAction.mockRejectedValue(new Error("fail"));
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("openai-key").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Delete"));
    fireEvent.change(screen.getByPlaceholderText("DELETE"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Delete failed" }));
    });
  });

  it("toggles k8s sync fields in add form", () => {
    render(<SecretsPanel initialSecrets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Add secret/i }));
    expect(screen.queryByPlaceholderText("secret name")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Sync to Kubernetes Secret/i));
    expect(screen.getByPlaceholderText("secret name")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("secret name"), { target: { value: "lab-sync" } });
    fireEvent.change(screen.getByPlaceholderText("KEY"), { target: { value: "TOKEN" } });
  });

  it("cancels update dialog", () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Update value"));
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.queryByText(/Replace secret value/i)).not.toBeInTheDocument();
  });

  it("closes reveal dialog and clears state", () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Reveal value"));
    fireEvent.click(screen.getAllByRole("button", { name: /Close/i })[0]!);
    expect(screen.queryByPlaceholderText("REVEAL")).not.toBeInTheDocument();
  });

  it("closes reveal dialog via onOpenChange", () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Reveal value"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByPlaceholderText("REVEAL")).not.toBeInTheDocument();
  });

  it("closes delete dialog via onOpenChange", () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("openai-key").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Delete"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByPlaceholderText("DELETE")).not.toBeInTheDocument();
  });

  it("cancels delete dialog", () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("openai-key").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Delete"));
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.queryByPlaceholderText("DELETE")).not.toBeInTheDocument();
  });

  it("syncs secret to kubernetes", async () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Sync to Kubernetes"));

    await waitFor(() => {
      expect(secretMocks.syncSecretToK8sAction).toHaveBeenCalledWith({ id: fakeSecrets[0].id });
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Synced to Kubernetes" }));
    });
  });

  it("toasts sync failure result", async () => {
    secretMocks.syncSecretToK8sAction.mockResolvedValue({ ok: false, error: "rbac denied" });
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Sync to Kubernetes"));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Sync failed", description: "rbac denied" })
      );
    });
  });

  it("toasts sync exception", async () => {
    secretMocks.syncSecretToK8sAction.mockRejectedValue(new Error("network"));
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Sync to Kubernetes"));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Sync failed", description: expect.stringContaining("network") })
      );
    });
  });

  it("changes category via Select onValueChange", async () => {
    render(<SecretsPanel initialSecrets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Add secret/i }));
    fireEvent.click(screen.getAllByTestId("select-fire-token")[0]!);
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "cat-test" } });
    fireEvent.change(screen.getByLabelText(/^Value$/i), { target: { value: "v" } });
    fireEvent.click(screen.getByRole("button", { name: /Save encrypted/i }));

    await waitFor(() => {
      expect(secretMocks.createSecretAction).toHaveBeenCalledWith(expect.objectContaining({ category: "token" }));
    });
  });

  it("changes namespace via Select onValueChange when sync enabled", async () => {
    render(<SecretsPanel initialSecrets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Add secret/i }));
    fireEvent.click(screen.getByLabelText(/Sync to Kubernetes Secret/i));
    fireEvent.click(screen.getAllByTestId("select-fire-dev").at(-1)!);
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "ns-test" } });
    fireEvent.change(screen.getByLabelText(/^Value$/i), { target: { value: "v" } });
    fireEvent.change(screen.getByPlaceholderText("secret name"), { target: { value: "lab-dev" } });
    fireEvent.change(screen.getByPlaceholderText("KEY"), { target: { value: "KEY" } });
    fireEvent.click(screen.getByRole("button", { name: /Save encrypted/i }));

    await waitFor(() => {
      expect(secretMocks.createSecretAction).toHaveBeenCalledWith(
        expect.objectContaining({
          k8sSync: expect.objectContaining({ namespace: "dev", secretName: "lab-dev", key: "KEY" })
        })
      );
    });
  });

  it("closes update dialog via onOpenChange", () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Update value"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText(/Replace secret value/i)).not.toBeInTheDocument();
  });

  it("deduplicates secrets when create returns an existing id", async () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    fireEvent.click(screen.getByRole("button", { name: /Add secret/i }));
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "dup" } });
    fireEvent.change(screen.getByLabelText(/^Value$/i), { target: { value: "v" } });
    secretMocks.createSecretAction.mockResolvedValueOnce({
      meta: { ...fakeSecrets[0], name: "dup" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Save encrypted/i }));

    await waitFor(() => {
      expect(screen.getByText("dup")).toBeInTheDocument();
      expect(screen.getByText("openai-key")).toBeInTheDocument();
      expect(screen.queryByText("hf-token")).not.toBeInTheDocument();
    });
  });

  it("shows raw category label when category is unknown", () => {
    const oddSecret = {
      ...fakeSecrets[0],
      category: "legacy-cat" as (typeof fakeSecrets)[0]["category"]
    };
    render(<SecretsPanel initialSecrets={[oddSecret]} />);
    expect(screen.getByText("legacy-cat")).toBeInTheDocument();
  });

  it("clears reveal state when dialog onOpenChange receives false", () => {
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Reveal value"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.closest("[data-state]") ?? dialog);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByPlaceholderText("REVEAL")).not.toBeInTheDocument();
  });

  it("swallows clipboard clear errors after reveal timeout", async () => {
    vi.useFakeTimers();
    writeText.mockRejectedValueOnce(new Error("denied"));
    render(<SecretsPanel initialSecrets={fakeSecrets} />);
    const row = screen.getByText("hf-token").closest("tr")!;
    fireEvent.click(within(row).getByTitle("Reveal value"));
    fireEvent.change(screen.getByPlaceholderText("REVEAL"), { target: { value: "REVEAL" } });
    fireEvent.click(screen.getByRole("button", { name: /^Reveal$/i }));

    await vi.runOnlyPendingTimersAsync();
    vi.advanceTimersByTime(30000);
    expect(writeText).toHaveBeenCalledWith("");
  });
});
