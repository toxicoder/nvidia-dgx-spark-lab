import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MachineStatePanel } from "../MachineStatePanel";
import { fakeMachineIdentity, fakeServices, fakePackages } from "@/lib/mocks/fixtures";

describe("MachineStatePanel component", () => {
  const initialData = {
    identity: fakeMachineIdentity,
    services: fakeServices,
    packages: fakePackages
  };

  it("renders identity, services and packages with fixture mock data", () => {
    render(<MachineStatePanel initialData={initialData} />);

    expect(screen.getByText(/IDENTITY \+ NVIDIA/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(fakeMachineIdentity.hostname, "i"))).toBeInTheDocument();
    expect(screen.getByText(/SERVICES/i)).toBeInTheDocument();
    expect(screen.getByText(/PACKAGES/i)).toBeInTheDocument();
    expect(screen.getAllByText(/k3s/i).length).toBeGreaterThan(0);
  });

  it("renders without crashing on typical package list", () => {
    render(<MachineStatePanel initialData={initialData} />);
    expect(screen.getByText(/PACKAGES/i)).toBeInTheDocument();
  });
});
