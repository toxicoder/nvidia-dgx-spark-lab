import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { fakeInferenceWorkloadsStatus } from "@/lib/mocks/fixtures";

const hostMocks = vi.hoisted(() => ({
  getInferenceWorkloadsAction: vi.fn(),
  checkCapacityAction: vi.fn(),
  startInferenceWorkloadAction: vi.fn(),
  stopInferenceWorkloadAction: vi.fn(),
  suggestFreeResourcesAction: vi.fn(),
  stopDevWorkspaceAction: vi.fn()
}));

const gateMocks = vi.hoisted(() => ({
  onFreed: null as (() => Promise<void>) | null
}));

vi.mock("@/actions/host-actions", () => hostMocks);

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: vi.fn() })
}));

vi.mock("../CapacityGateDialog", () => ({
  CapacityGateDialog: ({ onFreed }: { onFreed: () => Promise<void> }) => {
    gateMocks.onFreed = onFreed;
    return null;
  }
}));

import { InferencePanel } from "../InferencePanel";

describe("InferencePanel capacity gate callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostMocks.getInferenceWorkloadsAction.mockResolvedValue(fakeInferenceWorkloadsStatus);
    hostMocks.checkCapacityAction.mockResolvedValue({
      ok: true,
      verdict: "ok",
      action: "model:kimi-test",
      heavy: false,
      required: { gpus: 0, cpu: "1", memory: "1Gi" },
      available: { gpus: 2, cpu: "8", memory: "32Gi" },
      deficit: {}
    });
  });

  it("no-ops onFreed when no model is pending", async () => {
    render(<InferencePanel initialStatus={fakeInferenceWorkloadsStatus} />);
    await gateMocks.onFreed?.();
    expect(hostMocks.checkCapacityAction).not.toHaveBeenCalled();
  });
});
