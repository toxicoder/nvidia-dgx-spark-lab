import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { TasksPanel } from "../TasksPanel";
import { fakeContainers, fakeOllama } from "@/lib/mocks/fixtures";

describe("TasksPanel", () => {
  it("renders containers and ollama sections with fixture data", () => {
    const ui = TasksPanel({ containers: fakeContainers, ollama: fakeOllama });
    render(<>{ui}</>);

    expect(screen.getByText(/CONTAINERS \(docker\)/i)).toBeInTheDocument();
    expect(screen.getByText(/OLLAMA/i)).toBeInTheDocument();
    expect(screen.getAllByText(/kimi-test/i).length).toBeGreaterThan(0);

    const stops = screen.getAllByRole("button", { name: /stop/i });
    expect(stops.length).toBeGreaterThan(0);
  });

  it("shows error state when containers data has an error", () => {
    const ui = TasksPanel({
      containers: { error: "docker unavailable (mock)" },
      ollama: { raw: "" }
    });
    render(<>{ui}</>);

    expect(screen.getByText(/docker unavailable/i)).toBeInTheDocument();
  });

  it("renders ollama rows with missing tab columns", () => {
    const ui = TasksPanel({
      containers: fakeContainers,
      ollama: { raw: "NAME\tID\tSIZE\tMODIFIED\nmodel-only\tid123\t\t" }
    });
    render(<>{ui}</>);
    expect(screen.getByText("model-only")).toBeInTheDocument();
  });

  it("renders ollama rows with empty model name and populated size column", () => {
    const ui = TasksPanel({
      containers: fakeContainers,
      ollama: { raw: "NAME\tID\tSIZE\tMODIFIED\n\tid123\t4.2 GB\t" }
    });
    render(<>{ui}</>);
    expect(screen.getByText("4.2 GB")).toBeInTheDocument();
  });

  it("renders stop buttons for each container", () => {
    const ui = TasksPanel({ containers: fakeContainers, ollama: { raw: "ok" } });
    render(<>{ui}</>);

    const stops = screen.getAllByRole("button", { name: /stop/i });
    expect(stops.length).toBeGreaterThan(0);
  });
});
