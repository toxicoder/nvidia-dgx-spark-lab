/**
 * Site-wide configuration for the documentation app.
 *
 * Values mirror what the retired `mkdocs.yml` declared so that links, edit URLs and the
 * repository button keep pointing at the same places they always did.
 */

/** Name of the project, used as the docs subtitle under the wordmark. */
export const SITE_NAME = "nvidia-dgx-spark-lab";

/** Secondary brand voice shown in the wordmark. */
export const BRAND = "overeazy";

/** Repository URL, as declared by `repo_url` in `mkdocs.yml`. */
export const REPO_URL = "https://github.com/toxicoder/nvidia-dgx-spark-lab";

/** Owner/repository, parsed from {@link REPO_URL} for building source links. */
export const REPO = { user: "toxicoder", repo: "nvidia-dgx-spark-lab" } as const;

/**
 * Git ref that "Edit this page" and source links point at.
 *
 * Reproduces `docs/hooks.py`'s branch-aware `edit_uri`: the published docs are built per
 * alias (`latest` from `main`, `development` from `development`), and the ref has to match
 * the alias so an edit opens the file the reader is actually reading.
 */
export function gitRef(): string {
  const alias = (process.env.DGX_DOCS_VERSION ?? process.env.MIKE_DOCS_VERSION ?? "").trim();
  if (alias === "development") return "development";
  const override = (process.env.DGX_DOCS_GIT_REF ?? "").trim();
  return override || "main";
}

/** True when the current build is the development alias (drives the banner). */
export function isDevelopmentAlias(): boolean {
  const alias = (process.env.DGX_DOCS_VERSION ?? process.env.MIKE_DOCS_VERSION ?? "").trim();
  return alias === "development";
}

/**
 * Public base path of the deployed site, e.g. `/nvidia-dgx-spark-lab/latest`.
 *
 * GitHub project Pages serves this repository at `/<repo>/`, so a published alias must
 * bake that prefix into every asset URL.  `DOCS_ALIAS=latest|development` is what the
 * alias build scripts set; `NEXT_BASE_PATH` remains an explicit override (`/` means none).
 * Local `next dev` and the unprefixed export leave both unset, so the path stays empty.
 */
export function basePath(): string {
  const explicit = (process.env.NEXT_BASE_PATH ?? "").trim();
  if (explicit === "/") return "";
  if (explicit.length > 0) return explicit.replace(/\/$/, "");
  const alias = (process.env.DOCS_ALIAS ?? "").trim();
  if (alias === "latest" || alias === "development") {
    return `/${REPO.repo}/${alias}`;
  }
  return "";
}

/** URL of a file in the repository at the active ref. */
export function repoFileUrl(path: string): string {
  return `${REPO_URL}/blob/${gitRef()}/${path.replace(/^\/+/, "")}`;
}
