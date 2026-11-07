import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Panel, PanelActions, PanelBody, PanelDescription, PanelFooter, PanelHeader, PanelTitle } from "../ui/panel";
import { panelSubheaderClass, surfaceCardClass } from "../panel-styles";

describe("Panel", () => {
  it("renders the panel frame with the shared radius and elevation source", () => {
    render(<Panel data-testid="panel">content</Panel>);
    const frame = screen.getByTestId("panel");
    expect(frame).toBeInTheDocument();
    expect(frame.className).toContain("rounded-[var(--md-sys-shape-corner-medium)]");
    expect(frame.className).toContain("shadow-");
    expect(frame.className).toContain("bg-card");
  });

  it("renders PanelTitle as a real h2 so the outline is h1 -> h2", () => {
    render(
      <Panel>
        <PanelHeader>
          <PanelTitle>Resource Guard</PanelTitle>
        </PanelHeader>
      </Panel>
    );
    expect(screen.getByRole("heading", { level: 2, name: "Resource Guard" })).toBeInTheDocument();
  });

  it("lets a caller demote the title when it sits under another heading", () => {
    render(
      <Panel>
        <PanelTitle as="h3">Nested section</PanelTitle>
      </Panel>
    );
    expect(screen.getByRole("heading", { level: 3, name: "Nested section" })).toBeInTheDocument();
  });

  it("keeps panelSubheaderClass working for the 16 legacy call sites", () => {
    expect(panelSubheaderClass).toContain("flex items-center gap-2");
    expect(panelSubheaderClass).toContain("text-[var(--md-sys-color-primary)]");
    expect(panelSubheaderClass.startsWith("mb-3 ")).toBe(true);
  });

  it("composes header, description, actions, body and footer", () => {
    render(
      <Panel>
        <PanelHeader>
          <PanelTitle>Storage</PanelTitle>
          <PanelDescription>What is using /mnt/models.</PanelDescription>
          <PanelActions data-testid="actions">
            <button type="button">Refresh</button>
          </PanelActions>
        </PanelHeader>
        <PanelBody data-testid="body">body</PanelBody>
        <PanelFooter data-testid="footer">footer</PanelFooter>
      </Panel>
    );

    expect(screen.getByRole("heading", { level: 2, name: "Storage" })).toBeInTheDocument();
    expect(screen.getByText("What is using /mnt/models.")).toBeInTheDocument();
    expect(screen.getByTestId("actions")).toBeInTheDocument();
    expect(screen.getByTestId("body")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("shares one surface class with the inner cards", () => {
    render(<PanelBody data-testid="surface" className={surfaceCardClass} />);
    expect(screen.getByTestId("surface").className).toContain("bg-[var(--md-sys-color-surface-container-low)]");
  });
});
