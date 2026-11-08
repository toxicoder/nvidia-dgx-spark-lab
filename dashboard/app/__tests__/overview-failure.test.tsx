import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/DashboardShell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("@/components/SectionFailure", () => ({
  SectionFailure: ({ title, message }: { title: string; message: string }) => (
    <div data-testid="section-failure" data-title={title} data-message={message} />
  )
}));

vi.mock("@/components/SectionRollup", () => ({
  SectionRollup: () => <div data-testid="rollup" />
}));

vi.mock("@/components/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>
}));

describe("overview page when the cluster read fails", () => {
  it("names the failed read instead of rendering a KPI band of dashes", async () => {
    vi.resetModules();
    vi.doMock("@/lib/host", async () => {
      const actual = await vi.importActual<typeof import("@/lib/host")>("@/lib/host");
      return {
        ...actual,
        getClusterCapacity: async () => {
          throw new Error("kubectl timed out");
        }
      };
    });

    // OverviewKpis is an async server component the page nests in Suspense, so awaiting
    // the page alone would only ever render the fallback.
    const { OverviewKpis } = await import("@/app/(dashboard)/page");
    render(await OverviewKpis());

    const failure = screen.getByTestId("section-failure");
    expect(failure.getAttribute("data-title")).toMatch(/Cluster headroom/i);
    expect(failure.getAttribute("data-message")).toContain("kubectl timed out");

    vi.doUnmock("@/lib/host");
    vi.resetModules();
  });

  it("keeps the section roll-up reachable when the reads succeed", async () => {
    // A healthy overview must still enumerate every section: the roll-up is how each one
    // is reached now that the sections are separate routes.
    const Page = (await import("@/app/(dashboard)/page")).default;

    render(await Page());

    expect(screen.getByTestId("rollup")).toBeInTheDocument();
  });
});
