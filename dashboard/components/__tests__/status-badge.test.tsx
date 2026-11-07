import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlertTriangle, CheckCircle2, CircleOff, Play, XOctagon } from "lucide-react";

import { STATUS_BADGE_VARIANTS, StatusBadge, type StatusBadgeMap } from "../ui/status-badge";

const JOB_STATES = ["absent", "running", "succeeded", "failed", "error"] as const;
type JobState = (typeof JOB_STATES)[number];

/** The exhaustive map the caller supplies; a missing state fails to compile. */
const JOB_MAP: StatusBadgeMap<JobState> = {
  absent: { label: "not deployed", variant: "muted", icon: CircleOff },
  running: { label: "running", variant: "ok", icon: Play },
  succeeded: { label: "succeeded", variant: "info", icon: CheckCircle2 },
  failed: { label: "failed", variant: "danger", icon: XOctagon },
  error: { label: "error", variant: "warning", icon: AlertTriangle }
};

describe("StatusBadge", () => {
  it("renders every state of the caller's map, not a fallback", () => {
    render(
      <ul>
        {JOB_STATES.map((state) => (
          <li key={state}>
            <StatusBadge<JobState> state={state} map={JOB_MAP} />
          </li>
        ))}
      </ul>
    );

    expect(screen.getByText("not deployed")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.getByText("succeeded")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("never lets error and absent collapse into the same badge", () => {
    const { rerender } = render(<StatusBadge<JobState> state="error" map={JOB_MAP} />);
    expect(screen.getByText("error").closest("[data-variant]")?.getAttribute("data-variant")).toBe("warning");

    rerender(<StatusBadge<JobState> state="absent" map={JOB_MAP} />);
    expect(screen.getByText("not deployed").closest("[data-variant]")?.getAttribute("data-variant")).toBe("muted");
  });

  it("carries an icon alongside the text so colour is never the only signal", () => {
    render(<StatusBadge<JobState> state="failed" map={JOB_MAP} />);
    const badge = screen.getByText("failed").closest("[data-variant]");
    expect(badge?.querySelector("svg")).not.toBeNull();
  });

  it("renders text-only when a descriptor has no icon", () => {
    const map: StatusBadgeMap<"plain"> = { plain: { label: "plain", variant: "neutral" } };
    render(<StatusBadge<"plain"> state="plain" map={map} />);
    const badge = screen.getByText("plain").closest("[data-variant]");
    expect(badge?.querySelector("svg")).toBeNull();
    expect(badge?.getAttribute("data-variant")).toBe("neutral");
  });

  it("supports the documented variant vocabulary", () => {
    expect(STATUS_BADGE_VARIANTS).toEqual(["neutral", "info", "ok", "warning", "danger", "muted"]);
  });

  it("accepts a className for call-site tweaks", () => {
    render(<StatusBadge<JobState> state="running" map={JOB_MAP} className="ml-2" />);
    expect(screen.getByText("running").closest("[data-variant]")?.className).toContain("ml-2");
  });

  it("refuses to render a state a boundary payload smuggled past the closed set", () => {
    const smuggled = "deploying" as JobState;
    expect(() => render(<StatusBadge<JobState> state={smuggled} map={JOB_MAP} />)).toThrow(/deploying/);
  });
});
