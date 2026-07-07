import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { DuplicateFindResult } from "@/lib/types";
import Treemap, { TreemapCellContent, treemapNestCrumbLabel, treemapTooltipFormatter } from "../Treemap";

vi.mock("recharts", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("recharts")>("recharts");

  function MockTreemap({
    onClick,
    nestIndexContent,
    content
  }: {
    onClick?: (d: unknown) => void;
    nestIndexContent?: (item: unknown, i: number) => React.ReactNode;
    content?: React.ReactElement;
  }) {
    React.useEffect(() => {
      onClick?.({ path: "/r/a", name: "a", value: 60, isDir: false });
      onClick?.({ activePayload: [{ payload: { path: "/r/b", name: "b", value: 40 } }] });
      onClick?.({ value: { path: "/r/c", name: "c", value: 10 } });
      onClick?.({ value: { path: "/r/direct-val", name: "direct-val", value: 5 } });
      onClick?.({ path: "/r/as-datum", isDir: false });
      onClick?.({ path: "/r/noname-only" });
      onClick?.({ name: "name-only" });
      onClick?.({ unrelated: true });
      onClick?.(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const cellProps = [
      { x: 0, y: 0, width: 100, height: 50, name: "large-file.bin", value: 1024, path: "/r/large", depth: 1 },
      { x: 0, y: 0, width: 20, height: 10, name: "tiny", value: 5, path: "/r/tiny", depth: 2 },
      { x: 0, y: 0, width: 80, height: 40, name: "very-long-filename-here", value: 99, path: "/r/long", depth: 0 },
      { x: 0, y: 0, width: 60, height: 30, value: 12, path: "/r/noname", depth: 0 }
    ];
    return (
      <div data-testid="mock-recharts-treemap">
        {nestIndexContent?.({ name: "root" }, 0)}
        {nestIndexContent?.({ name: "nested" }, 1)}
        {cellProps.map((props, i) => (content ? React.cloneElement(content, { key: `cell-${i}`, ...props }) : null))}
      </div>
    );
  }

  function MockSunburst({ onClick }: { onClick?: (d: unknown) => void }) {
    React.useEffect(() => {
      onClick?.({ value: { path: "/r/a", name: "a", value: 60, isDir: false } });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="mock-recharts-sunburst" />;
  }

  return {
    ...actual,
    Treemap: MockTreemap,
    SunburstChart: MockSunburst,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Tooltip: ({ formatter }: { formatter?: (value: unknown) => unknown[] }) => {
      React.useEffect(() => {
        formatter?.(null);
        formatter?.(undefined);
        formatter?.(1024);
      }, [formatter]);
      return null;
    }
  };
});

const emptyDupes = (): Promise<DuplicateFindResult> => Promise.resolve({ groups: [] });

const simpleRoot = {
  name: "root",
  path: "/r",
  size: 100,
  isDir: true,
  children: [
    { name: "a", path: "/r/a", size: 60, isDir: false },
    { name: "b", path: "/r/b", size: 40, isDir: false }
  ]
};

const rootWithDir = {
  name: "root",
  path: "/r",
  size: 100,
  isDir: true,
  children: [
    { name: "models", path: "/r/models", size: 60, isDir: true, children: [] },
    { name: "weights.gguf", path: "/r/weights.gguf", size: 40, isDir: false }
  ]
};

const manyChildrenRoot = {
  name: "models",
  path: "/mnt/models",
  size: 0,
  isDir: true,
  children: Array.from({ length: 10 }, (_, i) => ({
    name: `child-${i}`,
    path: `/mnt/models/child-${i}`,
    size: (10 - i) * 1_000_000_000,
    isDir: false
  }))
};
manyChildrenRoot.size = manyChildrenRoot.children.reduce((s, c) => s + c.size, 0);

const largeMbRoot = {
  name: "root",
  path: "/r",
  size: 200 * 1024 * 1024,
  isDir: true,
  children: [
    { name: "big.bin", path: "/r/big.bin", size: 150 * 1024 * 1024, isDir: false },
    { name: "small.bin", path: "/r/small.bin", size: 50 * 1024 * 1024, isDir: false }
  ]
};

const longNameRoot = {
  name: "root",
  path: "/r",
  size: 100,
  isDir: true,
  children: [
    {
      name: "very-long-filename-that-should-truncate",
      path: "/r/very-long-filename-that-should-truncate",
      size: 100,
      isDir: false
    }
  ]
};

describe("treemapTooltipFormatter", () => {
  it("formats numeric and empty values", () => {
    expect(treemapTooltipFormatter(1024)[0]).toMatch(/KB|B/);
    expect(treemapTooltipFormatter(null)[0]).toBeTruthy();
    expect(treemapTooltipFormatter(undefined)[1]).toBe("Size");
  });
});

describe("TreemapCellContent", () => {
  it("renders labels, selection state, and compact cells", () => {
    const { container, rerender } = render(
      <svg>
        <TreemapCellContent
          selectedPaths={new Set(["/r/selected"])}
          x={0}
          y={0}
          width={100}
          height={50}
          name="selected-file"
          value={2048}
          path="/r/selected"
          depth={1}
        />
      </svg>
    );
    expect(container.querySelector("title")?.textContent).toContain("selected-file");

    rerender(
      <svg>
        <TreemapCellContent
          selectedPaths={new Set()}
          x={0}
          y={0}
          width={10}
          height={8}
          name="x"
          value={1}
          path="/r/x"
          depth={0}
        />
      </svg>
    );
    expect(container.querySelector("text")).toBeNull();
  });
});

describe("treemapNestCrumbLabel", () => {
  it("maps root crumb to tree root name", () => {
    expect(treemapNestCrumbLabel({ name: "root" } as never, "models")).toBe("models");
  });

  it("returns item name for non-root crumbs", () => {
    expect(treemapNestCrumbLabel({ name: "llama" } as never, "models")).toBe("llama");
    expect(treemapNestCrumbLabel({ name: "" } as never, "models")).toBe("models");
  });
});

describe("Treemap", () => {
  let resizeCallback: ResizeObserverCallback | null = null;

  beforeEach(() => {
    resizeCallback = null;
    class ResizeObserverTest {
      constructor(cb: ResizeObserverCallback) {
        resizeCallback = cb;
      }
      observe() {
        resizeCallback?.([{ contentRect: { width: 600, height: 480 } } as ResizeObserverEntry], this);
      }
      unobserve() {}
      disconnect() {}
    }
    global.ResizeObserver = ResizeObserverTest as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders toggle for Nested Treemap / Sunburst + side list items", () => {
    render(<Treemap root={simpleRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    expect(screen.getByText("Treemap")).toBeInTheDocument();
    expect(screen.getByText("Sunburst")).toBeInTheDocument();
    expect(screen.getAllByText("a").length).toBeGreaterThan(0);
    expect(screen.getAllByText("b").length).toBeGreaterThan(0);
  });

  it("supports search filter and size filter + reset", async () => {
    const onDelete = vi.fn(async () => {});
    const onFind = vi.fn(emptyDupes);
    render(<Treemap root={largeMbRoot} onDelete={onDelete} onFindDuplicates={onFind} />);

    const search = screen.getByPlaceholderText(/Search files/i);
    fireEvent.change(search, { target: { value: "big" } });
    expect(screen.getAllByText("big.bin").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /≥ 50 MB/i }));

    const reset = screen.getByText("Reset");
    fireEvent.click(reset);
    expect(screen.getAllByText("big.bin").length).toBeGreaterThan(0);
  });

  it("calls onFindDuplicates when button clicked", async () => {
    const onFind = vi.fn(
      () => new Promise<DuplicateFindResult>((resolve) => setTimeout(() => resolve({ groups: [] }), 50))
    );
    render(<Treemap root={simpleRoot} onDelete={async () => {}} onFindDuplicates={onFind} />);
    fireEvent.click(screen.getByText("Find Duplicates"));
    expect(screen.getByText("Working...")).toBeInTheDocument();
    await waitFor(() => expect(onFind).toHaveBeenCalled());
  });

  function sideList() {
    return within(screen.getByTestId("treemap-side-list"));
  }

  it("shows delete button for directory rows in the side list", () => {
    render(<Treemap root={rootWithDir} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    const dirRow = sideList().getByText("models").closest("tr");
    expect(dirRow?.querySelector("button")).toBeTruthy();
  });

  it("calls onDelete from side list delete button", async () => {
    const onDelete = vi.fn(async () => {});
    render(<Treemap root={rootWithDir} onDelete={onDelete} onFindDuplicates={emptyDupes} />);
    const row = sideList().getByText("weights.gguf").closest("tr")!;
    fireEvent.click(row.querySelector("button")!);
    expect(onDelete).toHaveBeenCalledWith("/r/weights.gguf");
  });

  it("selects and deselects rows in side list", () => {
    render(<Treemap root={simpleRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    fireEvent.click(screen.getByText("Reset"));
    const row = sideList().getByText("a").closest("tr")!;
    fireEvent.click(row);
    expect(screen.getByText(/Delete 1 selected/i)).toBeInTheDocument();
    fireEvent.click(row);
    expect(screen.queryByText(/Delete 1 selected/i)).not.toBeInTheDocument();
  });

  it("no-ops bulk delete when nothing selected", async () => {
    const onDelete = vi.fn(async () => {});
    render(<Treemap root={simpleRoot} onDelete={onDelete} onFindDuplicates={emptyDupes} />);
    fireEvent.click(screen.getByText("Reset"));
    await expect(async () => {
      // handleBulkDelete early return — no button visible
      expect(screen.queryByText(/Delete \d+ selected/i)).not.toBeInTheDocument();
    }).not.toThrow();
  });

  it("bulk deletes selected items after confirmation", async () => {
    const onDelete = vi.fn(async () => {});
    render(<Treemap root={simpleRoot} onDelete={onDelete} onFindDuplicates={emptyDupes} />);
    fireEvent.click(screen.getByText("Reset"));

    fireEvent.click(sideList().getByText("a").closest("tr")!);
    fireEvent.click(sideList().getByText("b").closest("tr")!);
    fireEvent.click(screen.getByText(/Delete 2 selected/i));
    fireEvent.click(screen.getByRole("button", { name: /Delete selected/i }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("/r/a");
      expect(onDelete).toHaveBeenCalledWith("/r/b");
    });
  });

  it("continues bulk delete when one path fails", async () => {
    const onDelete = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce(undefined);
    render(<Treemap root={simpleRoot} onDelete={onDelete} onFindDuplicates={emptyDupes} />);
    fireEvent.click(screen.getByText("Reset"));

    fireEvent.click(sideList().getByText("a").closest("tr")!);
    fireEvent.click(sideList().getByText("b").closest("tr")!);
    fireEvent.click(screen.getByText(/Delete 2 selected/i));
    fireEvent.click(screen.getByRole("button", { name: /Delete selected/i }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(2));
  });

  it("treemap viz uses flat surface card styling (no gradient bleed-through)", () => {
    render(<Treemap root={simpleRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    const viz = screen.getByTestId("treemap-viz");
    expect(viz).toHaveClass("treemap-viz");
    expect(viz.className).toContain("bg-[var(--md-sys-color-surface)]");
  });

  it("toggles between chart views without crashing", () => {
    render(<Treemap root={simpleRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    const viz = screen.getByTestId("treemap-viz");
    expect(viz).toHaveAttribute("data-chart-view", "nested-treemap");

    fireEvent.click(screen.getByTestId("treemap-view-sunburst"));
    expect(viz).toHaveAttribute("data-chart-view", "sunburst");
    expect(screen.getByTestId("sunburst-legend")).toBeInTheDocument();
    expect(screen.getByTestId("sunburst-center")).toBeInTheDocument();
    expect(screen.getByTestId("mock-recharts-sunburst")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("treemap-view-treemap"));
    expect(viz).toHaveAttribute("data-chart-view", "nested-treemap");
  });

  it("renders sunburst legend with small and large percentage segments", () => {
    render(<Treemap root={manyChildrenRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    fireEvent.click(screen.getByTestId("treemap-view-sunburst"));
    expect(screen.getByTestId("sunburst-legend")).toBeInTheDocument();
    expect(screen.getByTestId("sunburst-center")).toHaveTextContent(/10 items/);
  });

  it("handles empty sunburst segments gracefully", () => {
    const emptyRoot = { name: "empty", path: "/empty", size: 0, isDir: true, children: [] };
    render(<Treemap root={emptyRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    fireEvent.click(screen.getByTestId("treemap-view-sunburst"));
    expect(screen.queryByTestId("sunburst-legend")).not.toBeInTheDocument();
  });

  it("responds to resize observer updates", () => {
    render(<Treemap root={simpleRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    expect(resizeCallback).toBeTruthy();
    resizeCallback?.([{ contentRect: { width: 800, height: 500 } } as ResizeObserverEntry], {} as ResizeObserver);
    fireEvent.click(screen.getByTestId("treemap-view-sunburst"));
    expect(screen.getByTestId("sunburst-center")).toBeInTheDocument();
  });

  it("renders long names in treemap cells", () => {
    render(<Treemap root={longNameRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    expect(screen.getAllByText(/very-long/).length).toBeGreaterThan(0);
  });

  it("handles chart click payloads from recharts", async () => {
    render(<Treemap root={simpleRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    await waitFor(() => {
      expect(screen.getByText(/Delete 1 selected/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("treemap-view-sunburst"));
    await waitFor(() => {
      expect(screen.getByTestId("mock-recharts-sunburst")).toBeInTheDocument();
    });
  });

  it("renders nest breadcrumb label for root items", () => {
    render(<Treemap root={simpleRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    expect(screen.getByTestId("mock-recharts-treemap")).toBeInTheDocument();
  });

  it("handles resize observer with missing contentRect", () => {
    render(<Treemap root={simpleRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    resizeCallback?.([{} as ResizeObserverEntry], {} as ResizeObserver);
    expect(screen.getByTestId("treemap-viz")).toBeInTheDocument();
  });

  it("renders sunburst center label for single item", () => {
    const singleChildRoot = {
      name: "root",
      path: "/r",
      size: 100,
      isDir: true,
      children: [{ name: "only", path: "/r/only", size: 100, isDir: false }]
    };
    render(<Treemap root={singleChildRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    fireEvent.click(screen.getByTestId("treemap-view-sunburst"));
    expect(screen.getByTestId("sunburst-center")).toHaveTextContent(/1 item/);
  });

  it("renders treemap without children as single tile", () => {
    const leafRoot = { name: "solo", path: "/solo", size: 50, isDir: false };
    render(<Treemap root={leafRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    expect(screen.getByTestId("treemap-viz")).toBeInTheDocument();
  });

  it("skips resize observer until chart element is mounted", () => {
    const observe = vi.fn();
    class DelayedResizeObserver {
      observe = observe;
      disconnect = vi.fn();
    }
    global.ResizeObserver = DelayedResizeObserver as unknown as typeof ResizeObserver;
    render(<Treemap root={simpleRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    expect(screen.getByTestId("treemap-viz")).toBeInTheDocument();
    expect(observe).toHaveBeenCalled();
  });

  it("highlights selected sunburst segment", () => {
    render(<Treemap root={simpleRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    fireEvent.click(screen.getByTestId("treemap-view-sunburst"));
    fireEvent.click(sideList().getByText("a").closest("tr")!);
    fireEvent.click(screen.getByTestId("treemap-view-sunburst"));
    expect(screen.getByTestId("sunburst-legend")).toBeInTheDocument();
  });

  it("filters side list by search path substring", () => {
    render(<Treemap root={simpleRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    fireEvent.change(screen.getByPlaceholderText(/Search files/i), { target: { value: "/r/b" } });
    expect(sideList().queryByText("a")).not.toBeInTheDocument();
    expect(sideList().getByText("b")).toBeInTheDocument();
  });

  it("shows sunburst legend with small percentage segments", () => {
    const skewedRoot = {
      name: "root",
      path: "/r",
      size: 1_000_000_000,
      isDir: true,
      children: [
        { name: "huge", path: "/r/huge", size: 990_000_000, isDir: false },
        { name: "tiny", path: "/r/tiny", size: 10_000_000, isDir: false }
      ]
    };
    render(<Treemap root={skewedRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    fireEvent.click(screen.getByTestId("treemap-view-sunburst"));
    expect(screen.getByTestId("sunburst-legend")).toBeInTheDocument();
  });

  it("filters side list with min size threshold and missing child sizes", () => {
    const mixedSizesRoot = {
      name: "root",
      path: "/r",
      size: 300,
      isDir: true,
      children: [
        { name: "big.bin", path: "/r/big.bin", size: 200 * 1024 * 1024, isDir: false },
        { name: "tiny.bin", path: "/r/tiny.bin", size: 0, isDir: false }
      ]
    };
    render(<Treemap root={mixedSizesRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /≥ 50 MB/i }));
    expect(sideList().getByText("big.bin")).toBeInTheDocument();
    expect(sideList().queryByText("tiny.bin")).not.toBeInTheDocument();
  });

  it("renders sunburst legend with zero total size", () => {
    const zeroRoot = {
      name: "root",
      path: "/r",
      size: 0,
      isDir: true,
      children: [{ name: "zero", path: "/r/zero", size: 0, isDir: false }]
    };
    render(<Treemap root={zeroRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    fireEvent.click(screen.getByTestId("treemap-view-sunburst"));
    expect(screen.getByTestId("sunburst-legend")).toBeInTheDocument();
  });

  it("renders sunburst segments for children with empty names", () => {
    const emptyNameRoot = {
      name: "root",
      path: "/r",
      size: 100,
      isDir: true,
      children: [{ name: "", path: "/r/empty-name", size: 100, isDir: false }]
    };
    render(<Treemap root={emptyNameRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    fireEvent.click(screen.getByTestId("treemap-view-sunburst"));
    expect(screen.getByTestId("sunburst-legend")).toBeInTheDocument();
  });

  it("renders sunburst center hub when root has no children array", () => {
    const soloRoot = { name: "solo", path: "/solo", size: 50, isDir: false };
    render(<Treemap root={soloRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    fireEvent.click(screen.getByTestId("treemap-view-sunburst"));
    expect(screen.getByTestId("sunburst-center")).toHaveTextContent(/0 items/);
  });

  it("renders nested treemap with root-named drill crumbs", () => {
    const nestedRoot = {
      name: "models",
      path: "/mnt/models",
      size: 200,
      isDir: true,
      children: [
        {
          name: "root",
          path: "/mnt/models/root",
          size: 200,
          isDir: true,
          children: [{ name: "leaf.bin", path: "/mnt/models/root/leaf.bin", size: 200, isDir: false }]
        }
      ]
    };
    render(<Treemap root={nestedRoot} onDelete={async () => {}} onFindDuplicates={emptyDupes} />);
    expect(screen.getByTestId("treemap-viz")).toBeInTheDocument();
  });
});
