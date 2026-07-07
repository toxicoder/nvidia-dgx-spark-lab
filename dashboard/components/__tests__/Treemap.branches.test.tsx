import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TreemapCellContent } from "../Treemap";

describe("TreemapCellContent branches", () => {
  it("covers selection, truncation, compact layout, and payload fallbacks", () => {
    const { container, rerender } = render(
      <svg>
        <TreemapCellContent
          selectedPaths={new Set(["/r/sel"])}
          x={2}
          y={2}
          width={120}
          height={60}
          name="selected-long-name-here"
          value={4096}
          path="/r/sel"
          depth={3}
        />
      </svg>
    );
    expect(container.querySelector("rect")?.getAttribute("stroke-width")).toBe("2");
    expect(container.querySelectorAll("text").length).toBeGreaterThan(1);

    rerender(
      <svg>
        <TreemapCellContent
          selectedPaths={new Set()}
          x={0}
          y={0}
          width={30}
          height={12}
          payload={{ name: "from-payload", value: 8, path: "/r/payload" }}
        />
      </svg>
    );
    expect(container.querySelector("text")).toBeNull();

    rerender(
      <svg>
        <TreemapCellContent selectedPaths={new Set()} x={0} y={0} width={80} height={30} value={15} path="/r/noname" />
      </svg>
    );
    expect(container.querySelector("rect")).toBeTruthy();
  });

  it("falls back through numeric and payload props", () => {
    const { container } = render(
      <svg>
        <TreemapCellContent
          selectedPaths={new Set(["/r/payload-only"])}
          payload={{ name: "", value: 32, path: "/r/payload-only" }}
          depth={"bad" as unknown as number}
        />
      </svg>
    );
    expect(container.querySelector("rect")).toBeTruthy();
    expect(container.querySelector("title")).toBeNull();
  });

  it("reads path from payload when props.path is absent", () => {
    const { container } = render(
      <svg>
        <TreemapCellContent
          selectedPaths={new Set(["/r/from-payload"])}
          x={10}
          y={10}
          width={80}
          height={30}
          payload={{ path: "/r/from-payload", name: "payload-path", value: 9 }}
        />
      </svg>
    );
    expect(container.querySelector("rect")?.getAttribute("stroke-width")).toBe("2");
  });

  it("falls back to empty path when props and payload omit path", () => {
    const { container } = render(
      <svg>
        <TreemapCellContent
          selectedPaths={new Set()}
          x={10}
          y={10}
          width={80}
          height={30}
          path=""
          payload={{ name: "no-path", value: 4 }}
        />
      </svg>
    );
    expect(container.querySelector("rect")).toBeTruthy();
  });

  it("uses zero fallbacks for missing geometry and empty names", () => {
    const { container } = render(
      <svg>
        <TreemapCellContent selectedPaths={new Set()} width={80} height={30} path="/r/zero" />
      </svg>
    );
    expect(container.querySelector("rect")).toBeTruthy();
    expect(container.querySelector("text")).toBeNull();
  });
});
