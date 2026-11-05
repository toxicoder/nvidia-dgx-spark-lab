/**
 * Tests for the Mermaid fence renderer.
 *
 * `remarkMdxMermaid` turns a ```mermaid fence into `<Mermaid chart="..." />`, so this
 * component owns three things a reader sees: the diagram is drawn with the palette that
 * matches the active colour scheme (a diagram stuck on Mermaid's default palette looks broken
 * in dark mode), a failure shows the message AND the offending source instead of a blank
 * square, and an id safe for the SVG the library writes (Mermaid 12 rejects a repeated id,
 * and `useId()` emits colons that are illegal in an SVG id).
 *
 * The cancellation paths matter because a page that unmounts mid-render must not write into a
 * detached node or surface an error for a diagram nobody is looking at.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const ctl = vi.hoisted(() => {
  const state = {
    blockImport: false,
    initialize: null as unknown as { calls: unknown[] },
    renderMock: null as unknown as (...args: unknown[]) => Promise<{ svg: string }>
  };
  let releaseImport: () => void = () => {};
  const importGate = new Promise<void>((resolve) => {
    releaseImport = resolve;
  });
  return {
    state,
    importGate,
    releaseImport: () => releaseImport(),
    initialize: { calls: [] as unknown[] },
    renderMock: vi.fn()
  };
});

vi.mock("mermaid", async () => {
  if (ctl.state.blockImport) await ctl.importGate;
  return { default: { initialize: (options: unknown) => ctl.initialize.calls.push(options), render: ctl.renderMock } };
});

const theme = vi.hoisted(() => ({ resolvedTheme: "light" as string | undefined }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: theme.resolvedTheme }) }));

import { Mermaid, mermaidRenderId } from "../../components/mermaid";

describe("mermaidRenderId", () => {
  it("prefixes the React id so it is a legal CSS identifier", () => {
    expect(mermaidRenderId(":r1:")).toBe("mmdr1");
  });

  it("keeps characters that are legal in an id", () => {
    expect(mermaidRenderId("a-b_C9")).toBe("mmda-b_C9");
  });

  it("survives an id that is only punctuation", () => {
    expect(mermaidRenderId(":")).toBe("mmd");
    expect(mermaidRenderId("")).toBe("mmd");
  });
});

describe("Mermaid", () => {
  it("gives up quietly when the module is still loading at unmount", async () => {
    // Must stay the first test in the file: the mocked module factory blocks only while the
    // module is cold, which is what keeps the chain open across the unmount below.
    ctl.state.blockImport = true;
    const { unmount } = render(<Mermaid chart="graph TD; A-->B;" />);
    unmount();
    ctl.releaseImport();
    ctl.state.blockImport = false;
    await waitFor(() => expect(ctl.renderMock).not.toHaveBeenCalled());
    expect(ctl.initialize.calls).toHaveLength(0);
  });

  it("draws into a labelled, scrollable container", async () => {
    ctl.renderMock.mockResolvedValue({ svg: "<svg data-diagram='1'></svg>" });
    const { container } = render(<Mermaid chart="graph TD; A-->B;" />);
    const box = container.querySelector("div[aria-label='Mermaid diagram']");
    expect(box).not.toBeNull();
    expect(box?.className).toContain("overflow-auto");
    await waitFor(() => expect(box?.innerHTML).toContain("data-diagram"));
  });

  it("initialises Mermaid lazily, strictly, and with the dark palette in dark mode", async () => {
    theme.resolvedTheme = "dark";
    ctl.initialize.calls.length = 0;
    ctl.renderMock.mockResolvedValue({ svg: "<svg></svg>" });
    render(<Mermaid chart="graph TD; A-->B;" />);
    await waitFor(() => expect(ctl.initialize.calls.length).toBeGreaterThan(0));
    expect(ctl.initialize.calls.at(-1)).toEqual({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "dark"
    });
    theme.resolvedTheme = "light";
  });

  it("falls back to the neutral palette outside dark mode", async () => {
    theme.resolvedTheme = "light";
    ctl.initialize.calls.length = 0;
    ctl.renderMock.mockResolvedValue({ svg: "<svg></svg>" });
    render(<Mermaid chart="graph TD; A-->B;" />);
    await waitFor(() => expect(ctl.initialize.calls.at(-1)).toMatchObject({ theme: "neutral" }));
  });

  it("re-renders when the scheme flips so the diagram follows the theme", async () => {
    theme.resolvedTheme = "light";
    ctl.initialize.calls.length = 0;
    ctl.renderMock.mockResolvedValue({ svg: "<svg></svg>" });
    const { rerender } = render(<Mermaid chart="graph TD; A-->B;" />);
    await waitFor(() => expect(ctl.initialize.calls.at(-1)).toMatchObject({ theme: "neutral" }));
    theme.resolvedTheme = "dark";
    rerender(<Mermaid chart="graph TD; A-->B;" />);
    await waitFor(() => expect(ctl.initialize.calls.at(-1)).toMatchObject({ theme: "dark" }));
  });

  it("shows the failure message and the source when the diagram is invalid", async () => {
    ctl.renderMock.mockRejectedValue(new Error("Parse error on line 2"));
    render(<Mermaid chart="graph TD; A-->B;;;" />);
    expect(await screen.findByText("Mermaid diagram failed to render")).toBeInTheDocument();
    expect(screen.getByText("Parse error on line 2")).toBeInTheDocument();
    expect(screen.getByText("graph TD; A-->B;;;")).toBeInTheDocument();
  });

  it("stringifies a rejection that is not an Error", async () => {
    ctl.renderMock.mockRejectedValue("boom");
    render(<Mermaid chart="graph TD;" />);
    expect(await screen.findByText("Mermaid diagram failed to render")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("does not write into the node after an error view took over", async () => {
    ctl.renderMock.mockRejectedValue(new Error("nope"));
    const { rerender, container } = render(<Mermaid chart="graph TD; A-->B;" />);
    await screen.findByText("Mermaid diagram failed to render");
    // The error branch unmounts the measured div, so the next effect run finds no node and
    // has to bail out instead of throwing on a null reference.
    ctl.renderMock.mockResolvedValue({ svg: "<svg></svg>" });
    rerender(<Mermaid chart="graph TD; C-->D;" />);
    await waitFor(() => expect(container.querySelector("div[aria-label='Mermaid diagram']")).toBeNull());
  });

  it("stays quiet when a diagram fails after the component is gone", async () => {
    // The reader navigated away; surfacing an error panel for a diagram nobody is looking at
    // would also be a state update on an unmounted component.
    let rejectRender: ((reason: unknown) => void) | undefined;
    ctl.renderMock.mockImplementation(
      () =>
        new Promise<{ svg: string }>((_resolve, reject) => {
          rejectRender = reject;
        })
    );
    const { unmount } = render(<Mermaid chart="graph TD; A-->B;" />);
    await waitFor(() => expect(ctl.renderMock).toHaveBeenCalled());
    unmount();
    rejectRender?.(new Error("late parse error"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("Mermaid diagram failed to render")).toBeNull();
  });

  it("drops a late diagram result once the component is gone", async () => {
    let resolveRender: ((value: { svg: string }) => void) | undefined;
    ctl.renderMock.mockImplementation(
      () =>
        new Promise<{ svg: string }>((resolve) => {
          resolveRender = resolve;
        })
    );
    const { unmount } = render(<Mermaid chart="graph TD; A-->B;" />);
    await waitFor(() => expect(ctl.renderMock).toHaveBeenCalled());
    unmount();
    resolveRender?.({ svg: "<svg data-late='1'></svg>" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector("[data-late]")).toBeNull();
  });
});
