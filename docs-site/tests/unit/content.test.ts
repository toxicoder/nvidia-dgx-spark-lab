/**
 * Which frontmatter schema a page gets, and which tree the site bundles.
 *
 * `lib/content.ts` is the single place that decides whether a file is a contributor's page
 * or generator output.  Getting that wrong is loud in two different ways: a generated page
 * (TypeDoc and the shell generator emit no frontmatter at all) validated against the strict
 * schema fails the build, while a hand-written page validated against the lenient one loses
 * its required title.  The `tags` field is declared explicitly because the base schema drops
 * unknown keys, and tags are what MkDocs search matched on.
 */

import { describe, expect, it, vi } from "vitest";
import { metaSchema } from "fumadocs-core/source/schema";

/** Stands in for the bundler-time macro, whose runtime stub throws instead of returning. */
const macro = vi.hoisted(() => ({
  defineDocs: vi.fn((config: unknown) => ({
    config,
    toFumadocsSource: () => ({ kind: "fumadocs-source" })
  }))
}));

vi.mock("fumadocs-mdx/macro", () => ({
  defineDocs: macro.defineDocs,
  defineCollections: vi.fn()
}));

import { docSchema, docs, generatedSchema } from "../../lib/content";

/** The object the module handed to the macro. */
interface DocsCollectionConfig {
  dir: string;
  docs: {
    files: string[];
    schema: (options: { path: string }) => unknown;
  };
  meta: { schema: unknown };
}

function registered(): DocsCollectionConfig {
  return macro.defineDocs.mock.calls[0]?.[0] as DocsCollectionConfig;
}

/** The schema the module picks for an on-disk file path, as the compiler passes it. */
function schemaFor(path: string): unknown {
  return registered().docs.schema({ path });
}

describe("docs collection", () => {
  it("hands the site the one collection the macro built", () => {
    expect(macro.defineDocs).toHaveBeenCalledTimes(1);
    expect(docs).toBe(macro.defineDocs.mock.results[0]?.value);
  });

  it("bundles the repository docs tree in place, not a copy", () => {
    expect(registered().dir).toBe("../docs");
  });

  it("bundles both markdown extensions so renamed MDX pages are not lost", () => {
    expect(registered().docs.files).toEqual(["**/*.md", "**/*.mdx", "!includes/**"]);
  });

  it("keeps snippet inputs out of the page list", () => {
    expect(registered().docs.files).toContain("!includes/**");
  });

  it("validates meta.json with fumadocs' own schema", () => {
    expect(registered().meta.schema).toBe(metaSchema);
  });
});

describe("schema selection", () => {
  it("treats a generated page as generator output", () => {
    expect(schemaFor("/home/ci/nvidia-dgx-spark-lab/docs/generated/shell/reference.md")).toBe(generatedSchema);
  });

  it("matches generated as the leading path segment", () => {
    expect(schemaFor("generated/index.md")).toBe(generatedSchema);
  });

  it("matches generated as a middle path segment", () => {
    expect(schemaFor("/srv/docs/generated/dashboard/api.md")).toBe(generatedSchema);
  });

  it("matches generated as the trailing path segment", () => {
    expect(schemaFor("/srv/docs/generated")).toBe(generatedSchema);
  });

  it("normalises backslashes so a Windows build picks the same schema", () => {
    expect(schemaFor("C:\\workspace\\nvidia-dgx-spark-lab\\docs\\generated\\shell\\reference.md")).toBe(
      generatedSchema
    );
    expect(schemaFor("C:\\workspace\\nvidia-dgx-spark-lab\\docs\\operate\\index.md")).toBe(docSchema);
  });

  it("treats a contributor page as hand-written", () => {
    expect(schemaFor("/home/ci/nvidia-dgx-spark-lab/docs/operate/index.md")).toBe(docSchema);
  });

  it("does not match a segment that only ends with the marker", () => {
    expect(schemaFor("/srv/docs/generated-notes.md")).toBe(docSchema);
    expect(schemaFor("/srv/docs/notes-generated.md")).toBe(docSchema);
  });

  it("does not match a segment that only starts with the marker", () => {
    expect(schemaFor("/srv/docs/mygenerated/reference.md")).toBe(docSchema);
    expect(schemaFor("/srv/docs/generatedlib/index.md")).toBe(docSchema);
  });
});

describe("docSchema", () => {
  it("keeps tags written as a comma list", () => {
    const parsed = docSchema.parse({ title: "Resource Guard", tags: "capacity, nccl" });
    expect(parsed.tags).toBe("capacity, nccl");
  });

  it("keeps tags written as a YAML list", () => {
    const parsed = docSchema.parse({ title: "Resource Guard", tags: ["capacity", "nccl"] });
    expect(parsed.tags).toEqual(["capacity", "nccl"]);
  });

  it("requires a title, so a contributor page never renders without one", () => {
    expect(docSchema.safeParse({ description: "capacity gates" }).success).toBe(false);
  });

  it("drops frontmatter keys the site does not render", () => {
    const parsed = docSchema.parse({ title: "Resource Guard", tags: ["nccl"], sponsor: "acme" });
    expect(parsed).not.toHaveProperty("sponsor");
    expect(parsed.tags).toEqual(["nccl"]);
  });
});

describe("generatedSchema", () => {
  it("accepts the empty frontmatter the shell and dashboard generators emit", () => {
    const parsed = generatedSchema.parse({});
    expect(parsed.title).toBeUndefined();
  });

  it("keeps a title when the generator does emit one", () => {
    const parsed = generatedSchema.parse({ title: "Shell Reference" });
    expect(parsed.title).toBe("Shell Reference");
  });

  it("keeps tags on a generated page too", () => {
    const parsed = generatedSchema.parse({ tags: "shell" });
    expect(parsed.tags).toBe("shell");
  });
});
