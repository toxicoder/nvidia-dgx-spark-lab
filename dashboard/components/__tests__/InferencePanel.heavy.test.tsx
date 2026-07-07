import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { fakeCapacityCheck, fakeInferenceWorkloadsStatus } from "@/lib/mocks/fixtures";

const hostMocks = vi.hoisted(() => ({
  getInferenceWorkloadsAction: vi.fn(),
  checkCapacityAction: vi.fn(),
  startInferenceWorkloadAction: vi.fn(),
  stopInferenceWorkloadAction: vi.fn()
}));

vi.mock("@/actions/host-actions", () => hostMocks);

const toastMock = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock })
}));

vi.mock("@/components/HeavyConfirmDialog", () => ({
  HeavyConfirmDialog: ({ onConfirm }: { onConfirm: () => void }) => (
    <button type="button" data-testid="heavy-confirm-trigger" onClick={onConfirm}>
      Confirm heavy
    </button>
  )
}));

import { InferencePanel } from "../InferencePanel";

describe("InferencePanel heavy confirm branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostMocks.getInferenceWorkloadsAction.mockResolvedValue(fakeInferenceWorkloadsStatus);
    hostMocks.checkCapacityAction.mockResolvedValue(fakeCapacityCheck);
    hostMocks.startInferenceWorkloadAction.mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "" });
    hostMocks.stopInferenceWorkloadAction.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("no-ops heavy confirm when no model is pending", () => {
    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    fireEvent.click(screen.getByTestId("heavy-confirm-trigger"));
    expect(hostMocks.startInferenceWorkloadAction).not.toHaveBeenCalled();
  });
});
