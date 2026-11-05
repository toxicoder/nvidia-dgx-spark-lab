/**
 * Contract for the search route the static export publishes.
 *
 * `output: "export"` ships no server, so the Orama database has to be written to disk at
 * build time and fetched by the browser client in `components/search-dialog.tsx`.  Two
 * things keep search working on GitHub Pages: the route has to be evaluated during the
 * build (`force-static`), and it has to hand out the loader's *own* static handler -- a
 * hand-written wrapper would drop the build-time database and the client would get an empty
 * index, silently turning search into a box that finds nothing.
 */

import { describe, expect, it, vi } from "vitest";

/** Stands in for `createFromSource(...)` in `lib/source.ts`. */
const loader = vi.hoisted(() => {
  /** Serialized ZBSearch database, the shape `staticClient` loads with `load(db, data)`. */
  const database = {
    type: "advanced",
    docs: {
      "/resource-guard": { title: "Resource Guard", url: "/resource-guard", content: "capacity gates" },
      "/operate/dashboard": { title: "Dashboard", url: "/operate/dashboard", content: "host actions" }
    }
  };
  const exported = vi.fn(async () => database);
  return { database, exported, staticGET: vi.fn(async () => Response.json(await exported())) };
});

vi.mock("@/lib/source", () => ({ search: { staticGET: loader.staticGET } }));

// Imported after the mock so the route sees the stubbed loader.
import * as searchRoute from "../../app/api/search/route";
import { GET, dynamic } from "../../app/api/search/route";

describe("GET /api/search", () => {
  it("re-exports the loader's own static handler", () => {
    expect(GET).toBe(loader.staticGET);
  });

  it("publishes the exported database as JSON", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual(loader.database);
    expect(loader.exported).toHaveBeenCalledTimes(1);
  });

  it("answers a browser query with the whole index, matched client-side", async () => {
    const response = await GET();
    const payload = (await response.json()) as { docs: Record<string, unknown> };
    expect(Object.keys(payload.docs)).toEqual(["/resource-guard", "/operate/dashboard"]);
  });

  it("asks the exporter to evaluate the route at build time", () => {
    expect(dynamic).toBe("force-static");
  });

  it("offers no server-side handler for the export to pick up", () => {
    expect(Object.keys(searchRoute).sort()).toEqual(["GET", "dynamic"]);
  });
});
