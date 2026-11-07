import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

import {
  SECTION_DESCRIPTORS,
  SECTION_GROUP_LABELS,
  findSection,
  sectionsForGroup,
  sectionIcon
} from "@/lib/section-registry";
import { DASHBOARD_SECTIONS, DASHBOARD_SECTION_GROUPS } from "@/lib/types";

const SECTIONS_DIR = path.join(__dirname, "..", "..", "components", "sections");
const ROUTER_FILE = path.join(__dirname, "..", "..", "app", "(dashboard)", "[section]", "page.tsx");

/**
 * The drift gate.
 *
 * The sidebar used to be a hand-maintained array, and it silently lost the
 * Agent Chat panel — the section shipped, no link ever reached it, and nothing
 * failed. These assertions make that class of mistake a test failure instead of
 * a support question: the closed set, the descriptors, the on-disk modules, and
 * the router's view map must name exactly the same sections.
 */
describe("section registry drift gate", () => {
  it("has a descriptor for every section in the closed set, and no extras", () => {
    expect(Object.keys(SECTION_DESCRIPTORS).sort()).toEqual([...DASHBOARD_SECTIONS].sort());
  });

  it("ships a module for every section, and no module without a section", () => {
    const onDisk = fs
      .readdirSync(SECTIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => fs.existsSync(path.join(SECTIONS_DIR, name, "index.tsx")))
      .sort();

    expect(
      onDisk,
      `sections with no module: ${DASHBOARD_SECTIONS.filter((s) => !onDisk.includes(s)).join(", ")}`
    ).toEqual([...DASHBOARD_SECTIONS].sort());
  });

  it("wires every section into the route's view map", () => {
    const routerSource = fs.readFileSync(ROUTER_FILE, "utf8");
    // Keys are quoted only where the slug needs it (`"agent-chat"`), so match
    // both spellings rather than forcing one style on the router.
    const missing = DASHBOARD_SECTIONS.filter((slug) => !new RegExp(`["']?${slug}["']?\\s*:`).test(routerSource));
    expect(missing, `sections not wired into SECTION_VIEWS: ${missing.join(", ")}`).toEqual([]);
  });

  it("refuses to run on an empty section set", () => {
    expect(DASHBOARD_SECTIONS.length).toBeGreaterThan(0);
    expect(Object.keys(SECTION_DESCRIPTORS).length).toBe(DASHBOARD_SECTIONS.length);
  });
});

describe("section descriptors", () => {
  it("gives every section non-empty chrome text and an icon", () => {
    for (const slug of DASHBOARD_SECTIONS) {
      const descriptor = SECTION_DESCRIPTORS[slug];
      expect(descriptor.slug, `${slug} slug mismatch`).toBe(slug);
      expect(descriptor.label.trim().length, `${slug} label`).toBeGreaterThan(0);
      expect(descriptor.title.trim().length, `${slug} title`).toBeGreaterThan(0);
      expect(descriptor.description.trim().length, `${slug} description`).toBeGreaterThan(10);
      // lucide v1 hands back forwardRef objects, not plain functions, so the
      // contract is "something React can render", not a specific shape.
      expect(descriptor.icon, `${slug} icon`).toBeTruthy();
    }
  });

  it("places every section in a declared group", () => {
    for (const slug of DASHBOARD_SECTIONS) {
      expect(DASHBOARD_SECTION_GROUPS).toContain(SECTION_DESCRIPTORS[slug].group);
    }
  });

  it("labels every group it renders", () => {
    for (const group of DASHBOARD_SECTION_GROUPS) {
      expect(SECTION_GROUP_LABELS[group]?.trim().length, `group ${group}`).toBeGreaterThan(0);
    }
  });
});

describe("sectionsForGroup", () => {
  it("returns only that group's sections, in closed-set order", () => {
    for (const group of DASHBOARD_SECTION_GROUPS) {
      const result = sectionsForGroup(group);
      expect(result.every((descriptor) => descriptor.group === group)).toBe(true);
      const expected = DASHBOARD_SECTIONS.filter((slug) => SECTION_DESCRIPTORS[slug].group === group);
      expect(result.map((descriptor) => descriptor.slug)).toEqual(expected);
    }
  });

  it("covers the whole console when every group is rendered", () => {
    const all = DASHBOARD_SECTION_GROUPS.flatMap((group) => sectionsForGroup(group));
    expect(all.map((descriptor) => descriptor.slug).sort()).toEqual([...DASHBOARD_SECTIONS].sort());
  });
});

describe("findSection", () => {
  it("resolves a known slug", () => {
    expect(findSection("storage")?.slug).toBe("storage");
  });

  it("resolves the section that the old sidebar lost", () => {
    expect(findSection("agent-chat")?.label).toBe("Agent Chat");
  });

  it("rejects an unknown segment so the route can 404", () => {
    expect(findSection("does-not-exist")).toBeUndefined();
    expect(findSection("")).toBeUndefined();
  });
});

describe("sectionIcon", () => {
  it("returns the section's own icon", () => {
    expect(sectionIcon("storage")).toBe(SECTION_DESCRIPTORS.storage.icon);
  });

  it("falls back to a generic icon for an unknown slug", () => {
    expect(sectionIcon("nope")).toBeTruthy();
  });
});
