/**
 * Tests for the published-site configuration: base path, git ref, and source links.
 *
 * GitHub project Pages serves the repo at `/<repo>/`, so an alias build that bakes
 * `basePath=/latest` asks the browser for `https://<user>.github.io/latest/_next/...` and
 * every stylesheet 404s.  The helper must prefix the repo name; local `next dev` and the
 * unprefixed export used by render-check keep an empty path.
 *
 * The ref helpers matter for the same reason a reader cares about a broken link: "Edit this
 * page" and every source link have to open the file on the branch the reader is actually
 * reading, which is what the alias-decoding build stamps into the bundle.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { basePath, gitRef, isDevelopmentAlias, REPO, REPO_URL, repoFileUrl } from "../../lib/site";

const ENV_KEYS = ["NEXT_BASE_PATH", "DOCS_ALIAS", "DGX_DOCS_VERSION", "MIKE_DOCS_VERSION", "DGX_DOCS_GIT_REF"] as const;

const originalEnv: Record<string, string | undefined> = {};

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

for (const key of ENV_KEYS) {
  originalEnv[key] = process.env[key];
  delete process.env[key];
}

/** Start every test from a clean, unset environment. */
beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("basePath", () => {
  it("is empty for local dev and the unprefixed export", () => {
    expect(basePath()).toBe("");
  });

  it("prefixes the GitHub Pages repo path for the latest alias", () => {
    process.env.DOCS_ALIAS = "latest";
    expect(basePath()).toBe(`/${REPO.repo}/latest`);
  });

  it("prefixes the GitHub Pages repo path for the development alias", () => {
    process.env.DOCS_ALIAS = "development";
    expect(basePath()).toBe(`/${REPO.repo}/development`);
  });

  it("lets NEXT_BASE_PATH override the alias", () => {
    process.env.DOCS_ALIAS = "latest";
    process.env.NEXT_BASE_PATH = "/custom";
    expect(basePath()).toBe("/custom");
  });

  it("treats NEXT_BASE_PATH=/ as no prefix", () => {
    process.env.NEXT_BASE_PATH = "/";
    process.env.DOCS_ALIAS = "latest";
    expect(basePath()).toBe("");
  });

  it("drops the trailing slash of an explicit path so assets do not double up", () => {
    process.env.NEXT_BASE_PATH = "/nvidia-dgx-spark-lab/development/";
    expect(basePath()).toBe("/nvidia-dgx-spark-lab/development");
  });

  it("ignores an alias that is not a published one", () => {
    process.env.DOCS_ALIAS = "v1.2.3";
    expect(basePath()).toBe("");
  });

  it("trims the whitespace the alias is often exported with", () => {
    process.env.DOCS_ALIAS = "  latest  ";
    expect(basePath()).toBe(`/${REPO.repo}/latest`);
  });
});

describe("gitRef", () => {
  it("points at main when the build carries no alias", () => {
    expect(gitRef()).toBe("main");
  });

  it("points at the development branch for the development alias", () => {
    process.env.DGX_DOCS_VERSION = "development";
    expect(gitRef()).toBe("development");
  });

  it("falls back to the retired mkdocs variable when the new one is unset", () => {
    process.env.MIKE_DOCS_VERSION = "development";
    expect(gitRef()).toBe("development");
  });

  it("prefers the new variable over the retired one", () => {
    process.env.DGX_DOCS_VERSION = "1.2.3";
    process.env.MIKE_DOCS_VERSION = "development";
    expect(gitRef()).toBe("main");
  });

  it("trims the whitespace the alias is often exported with", () => {
    process.env.DGX_DOCS_VERSION = "  development  ";
    expect(gitRef()).toBe("development");
  });

  it("takes an explicit ref when the build pins one", () => {
    process.env.DGX_DOCS_GIT_REF = "v1.2.3";
    expect(gitRef()).toBe("v1.2.3");
  });

  it("trims the whitespace the explicit ref is often exported with", () => {
    process.env.DGX_DOCS_GIT_REF = "  release/1.2  ";
    expect(gitRef()).toBe("release/1.2");
  });

  it("treats a whitespace-only ref as unset", () => {
    process.env.DGX_DOCS_GIT_REF = "   ";
    expect(gitRef()).toBe("main");
  });

  it("keeps the development alias ahead of an unrelated ref", () => {
    process.env.DGX_DOCS_VERSION = "development";
    process.env.DGX_DOCS_GIT_REF = "v1.2.3";
    expect(gitRef()).toBe("development");
  });
});

describe("isDevelopmentAlias", () => {
  it("is true for the development alias", () => {
    process.env.DGX_DOCS_VERSION = "development";
    expect(isDevelopmentAlias()).toBe(true);
  });

  it("is true when only the retired mkdocs variable carries the alias", () => {
    process.env.MIKE_DOCS_VERSION = " development ";
    expect(isDevelopmentAlias()).toBe(true);
  });

  it("is false for a released alias", () => {
    process.env.DGX_DOCS_VERSION = "latest";
    expect(isDevelopmentAlias()).toBe(false);
  });

  it("is false when the build carries no alias", () => {
    expect(isDevelopmentAlias()).toBe(false);
  });
});

describe("repoFileUrl", () => {
  it("links a file on the branch the build was published from", () => {
    expect(repoFileUrl("docs/operate/index.md")).toBe(`${REPO_URL}/blob/main/docs/operate/index.md`);
  });

  it("links the same file on the development branch for the development alias", () => {
    process.env.DGX_DOCS_VERSION = "development";
    expect(repoFileUrl("docs/index.md")).toBe(`${REPO_URL}/blob/development/docs/index.md`);
  });

  it("strips the leading slashes a caller may have added", () => {
    expect(repoFileUrl("///docs/index.md")).toBe(`${REPO_URL}/blob/main/docs/index.md`);
  });
});
