import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MachineStateClient } from "../MachineStateClient";
import { fakeMachineIdentity, fakePackages, fakeServices } from "@/lib/mocks/fixtures";

const getMachineStateAction = vi.fn();

vi.mock("@/actions/host-actions", () => ({
  getMachineStateAction: (...args: unknown[]) => getMachineStateAction(...args)
}));

const toastMock = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock })
}));

describe("MachineStateClient", () => {
  const initialData = {
    identity: fakeMachineIdentity,
    services: fakeServices,
    packages: fakePackages
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getMachineStateAction.mockResolvedValue({
      identity: { hostname: "spark1", nvidia: "driver 550" },
      services: { services: ["k3s.service"] },
      packages: { packages: ["docker"] }
    });
  });

  it("renders identity, services and packages from initial data", () => {
    render(<MachineStateClient initialData={initialData} />);

    expect(screen.getByTestId("machine-state-client")).toBeInTheDocument();
    expect(screen.getByText(fakeMachineIdentity.hostname)).toBeInTheDocument();
    expect(screen.getAllByText(/k3s/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/docker/i).length).toBeGreaterThan(0);
  });

  it("refreshes machine state on button click", async () => {
    render(<MachineStateClient initialData={initialData} />);

    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));

    await waitFor(() => {
      expect(getMachineStateAction).toHaveBeenCalled();
      expect(screen.getByText("spark1")).toBeInTheDocument();
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Refreshed", variant: "success" }));
    });
  });

  it("toasts error when refresh fails", async () => {
    getMachineStateAction.mockRejectedValue(new Error("host unreachable"));

    render(<MachineStateClient initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Refresh failed", description: "host unreachable", variant: "error" })
      );
    });
  });

  it("stringifies non-Error refresh failures", async () => {
    getMachineStateAction.mockRejectedValue("timeout");

    render(<MachineStateClient initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: "timeout", variant: "error" }));
    });
  });

  it("renders empty services and packages when undefined", () => {
    render(
      <MachineStateClient
        initialData={{
          identity: fakeMachineIdentity,
          services: undefined as unknown as typeof fakeServices,
          packages: undefined as unknown as typeof fakePackages
        }}
      />
    );
    expect(screen.getByText("SERVICES")).toBeInTheDocument();
    expect(screen.getByText(/PACKAGES/)).toBeInTheDocument();
  });

  it("filters empty identity rows", () => {
    render(
      <MachineStateClient
        initialData={{
          identity: { hostname: "", nvidia: "" },
          services: fakeServices,
          packages: fakePackages
        }}
      />
    );
    expect(screen.queryByText("Hostname")).not.toBeInTheDocument();
  });
});
