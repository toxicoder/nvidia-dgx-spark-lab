import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

/** Controlled harness: selection follows the parent, exactly as WorkspacesPanel does. */
function Harness({ onValueChange }: { onValueChange?: (value: string) => void }): React.JSX.Element {
  const [value, setValue] = React.useState("coder");
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
    >
      <TabsList aria-label="Workspaces">
        <TabsTrigger value="coder">Coder</TabsTrigger>
        <TabsTrigger value="kasm">Kasm</TabsTrigger>
        <TabsTrigger value="vscode">VS Code</TabsTrigger>
      </TabsList>
      <TabsContent value="coder">Coder panel</TabsContent>
      <TabsContent value="kasm">Kasm panel</TabsContent>
      <TabsContent value="vscode">VS Code panel</TabsContent>
    </Tabs>
  );
}

function trigger(value: string): HTMLElement {
  return screen.getByTestId(`ui-tabs-trigger-${value}`);
}

function panel(value: string): HTMLElement {
  return screen.getByTestId(`ui-tabs-content-${value}`);
}

/** Radix moves focus on a macrotask, so a key press needs one turn of the loop to land. */
async function pressKey(element: HTMLElement, key: string): Promise<void> {
  fireEvent.keyDown(element, { key });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Radix activates a tab on mousedown, not click. */
function activate(value: string): void {
  fireEvent.mouseDown(trigger(value));
}

describe("Tabs", () => {
  it("keeps the data-testid contract the panel tests key off", () => {
    render(<Harness />);
    expect(screen.getByTestId("ui-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("ui-tabs-trigger-coder")).toBeInTheDocument();
    expect(screen.getByTestId("ui-tabs-content-coder")).toBeInTheDocument();
  });

  it("implements the WAI-ARIA tablist roles", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(trigger("coder")).toHaveAttribute("role", "tab");
    expect(trigger("coder")).toHaveAttribute("aria-selected", "true");
    expect(trigger("kasm")).toHaveAttribute("aria-selected", "false");
  });

  it("links each trigger to its panel and back", () => {
    render(<Harness />);
    const selectedTrigger = trigger("coder");
    expect(selectedTrigger.getAttribute("aria-controls")).toBe(panel("coder").id);
    expect(panel("coder").getAttribute("aria-labelledby")).toBe(selectedTrigger.id);
    expect(panel("coder")).toHaveAttribute("role", "tabpanel");
  });

  it("keeps one roving tab stop so Tab leaves the tablist", () => {
    render(<Harness />);
    // Radix makes the group the entry point and only the current item tabbable.
    expect(screen.getByRole("tablist")).toHaveAttribute("tabindex", "0");
    expect(trigger("coder")).toHaveAttribute("tabindex", "-1");

    activate("kasm");
    expect(trigger("kasm")).toHaveAttribute("tabindex", "0");
    expect(trigger("coder")).toHaveAttribute("tabindex", "-1");
    expect(trigger("vscode")).toHaveAttribute("tabindex", "-1");
  });

  it("moves selection with ArrowRight and ArrowLeft", async () => {
    render(<Harness />);
    trigger("coder").focus();
    await pressKey(trigger("coder"), "ArrowRight");
    expect(trigger("kasm")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Kasm panel")).toBeInTheDocument();

    await pressKey(trigger("kasm"), "ArrowLeft");
    expect(trigger("coder")).toHaveAttribute("aria-selected", "true");
  });

  it("wraps at both ends and jumps with Home/End", async () => {
    render(<Harness />);
    trigger("coder").focus();
    await pressKey(trigger("coder"), "ArrowLeft");
    expect(trigger("vscode")).toHaveAttribute("aria-selected", "true");

    await pressKey(trigger("vscode"), "Home");
    expect(trigger("coder")).toHaveAttribute("aria-selected", "true");

    await pressKey(trigger("coder"), "End");
    expect(trigger("vscode")).toHaveAttribute("aria-selected", "true");
  });

  it("selects from the keyboard with Enter", async () => {
    render(<Harness />);
    trigger("kasm").focus();
    await pressKey(trigger("kasm"), "Enter");
    expect(trigger("kasm")).toHaveAttribute("aria-selected", "true");
  });

  it("hides the unselected panel rather than leaving it in the a11y tree", () => {
    render(<Harness />);
    expect(panel("coder")).toBeVisible();
    expect(panel("kasm")).not.toBeVisible();
  });

  it("selects on pointer press and reports the change", () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);
    activate("kasm");
    expect(onValueChange).toHaveBeenCalledWith("kasm");
    expect(trigger("kasm")).toHaveAttribute("aria-selected", "true");
  });

  it("selects on a plain click too, so a click-driven caller still switches", () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);
    fireEvent.click(trigger("kasm"));
    expect(onValueChange).toHaveBeenCalledWith("kasm");
    expect(trigger("kasm")).toHaveAttribute("aria-selected", "true");
  });

  it("does not reselect the active tab", () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);
    activate("coder");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("accepts a className on the root", () => {
    render(
      <Tabs value="a" onValueChange={vi.fn()} className="mt-4">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">A</TabsContent>
      </Tabs>
    );
    expect(screen.getByTestId("ui-tabs").className).toContain("w-full");
    expect(screen.getByTestId("ui-tabs").className).toContain("mt-4");
  });
});
