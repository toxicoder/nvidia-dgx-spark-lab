# Documentation site migration: MkDocs → Fumadocs

The documentation site moved from **Material for MkDocs** to **Fumadocs** (Next.js App Router).
The content did not move: pages still live in `docs/`, the generators still write
`docs/generated/`, and the contributor rules in `docs/CONTRIBUTING.md` still apply.

**What's on this page**

- What changed and what did not
- How to run the site locally
- How the published URLs stay stable
- Leftover MkDocs files that can go after the first green preview

**What this enables**

- Reviewing this change knowing which diffs are mechanical
- Reproducing the site build without a Python docs toolchain
- Refreshing screenshot baselines the safe way

## What changed

| Area | Before | After |
| --- | --- | --- |
| Renderer | `mkdocs` + Material theme | Fumadocs (`fumadocs-core`, `fumadocs-mdx`, `fumadocs-ui`) on Next.js 16, static export |
| App | none (theme + `mkdocs.yml`) | `docs-site/` (App Router, `output: "export"`) |
| Content | `docs/**/*.md` | unchanged location; pages that need JSX are `.mdx` |
| Navigation | `mkdocs.yml` `nav:` | `docs-site/lib/nav.json`, transcribed once by `docs-site/scripts/gen_nav.py` and hand-maintained since (`npm run nav:check` verifies it) |
| Search | Material search | Orama index at `/api/search`, searchable by title **and** `tags` |
| Publishing | `mike deploy` → `gh-pages` branch | two static exports (`/<repo>/latest/`, `/<repo>/development/`) → `gh-pages` (with `.nojekyll`) |
| Version banner | `docs/hooks.py` | `DGX_DOCS_VERSION` read by the app |
| Edit-on-GitHub | `hooks.py` `on_config` | same behaviour, branch-aware, in `docs-site/lib/site.ts` |

### Syntax mapping (mechanical, not editorial)

No prose was rewritten. The codemod (`docs-site/scripts/codemod_mkdocs_to_mdx.py`, guarded by
`docs-site/test_codemod.py` which asserts the projected prose is byte-identical) maps:

| MkDocs | Fumadocs |
| --- | --- |
| `!!! note "Title"` / `warning` / `danger` / `tip` | `<Callout type="info\|warning\|error" title="…">` |
| `=== "Tab"` blocks | `<Tabs groupId="…" items={[…]}>` / `<Tab value="…">` |
| `--8<-- "docs/includes/foo.md"` | `<DocInclude name="foo" />` |
| `--8<-- "docs/includes/cluster-config.md"` | `<ClusterConfigPanel />` |
| auto-appended abbreviations | `<GlossaryTooltip>` fed by `docs/includes/abbreviations.md` |
| `--8<--` of a generated file | MDX import of the same file |
| `{{TOKEN}}` panel + `command-vars.js` | `docs-site/components/cluster-config-panel.tsx` (same storage key, so returning readers keep their values) |

Pages that gained none of those keep the `.md` extension; the rest are `.mdx`. Body text is
otherwise untouched.

## Running it locally

```bash
bazelisk run //docs:serve                       # dev server, hot reload, http://localhost:3005
bazelisk run //docs:docs                        # static export → docs-site/out/
bazelisk run //docs:preview                     # export + serve it
bazelisk test //docs-site:unit //docs-site:typecheck
bazelisk run //docs-site:visual-linux            # screenshots vs baselines, in the CI image
```

The screenshot comparison needs Docker: the committed baselines are drawn by the pinned
Playwright container, and comparing them against a different Chromium would report every page as
changed. See "Screenshot baselines" below.

Without Bazel:

```bash
./docs/setup-docs.sh                             # npm ci + python tooling
./docs/manage-docs.sh serve
./docs/manage-docs.sh build --version development
```

Inside `docs-site/` the same steps are npm scripts: `npm run dev`, `npm run build`,
`npm run visual`, `npm run unit`, `npm run nav:check`, `npm run verify`.  `nav:generate` and
`codemod` remain for a repository that still has its `mkdocs.yml`; in this one the nav is
hand-maintained, so `nav:generate` reports that and points at `nav:check`.

Dependencies: Node 22+ (the devcontainer has it; on a host `brew install node@22`). Python is
only needed by the generators and the pytest gates — `docs/requirements.txt` no longer installs
MkDocs.

## Stable URLs

The old site published `…/latest/` and `…/development/` through mike. Both aliases are now
separate exports of the same commit, built with `DOCS_ALIAS=latest` and `development`
(`//docs-site:build-latest`, `//docs-site:build-development`) so Next bakes
`basePath=/nvidia-dgx-spark-lab/<alias>` into asset URLs. `.github/workflows/deploy-docs.yml`
assembles them under `_site/`, writes a root `.nojekyll` (legacy GitHub Pages runs Jekyll,
which would otherwise drop `_next/`), and fast-forwards the `gh-pages` branch. Every previously
published URL keeps resolving; a root `index.html` forwards bare `…/<repo>/` traffic to
`/latest/`, so no redirect service is needed.

The development alias renders a banner; the branch used by “Edit on GitHub” and in-page source
links comes from `DGX_DOCS_VERSION` (override locally with `DGX_DOCS_GIT_REF`).

## Screenshot baselines

`docs-site/tests/visual/` compares the export against committed goldens at both desktop and
mobile widths. **Capture them in the CI image, never on a laptop**: font metrics differ per
platform, so macOS baselines will not match Linux CI Chromium and the `docs-and-render` job fails.

```bash
# Requires Docker running; pulls the Playwright image pinned to the suite's own version.
bazelisk run //docs-site:visual-linux -- --update    # or: npm run visual:linux:update
```

That launcher runs the suite inside `linux/amd64` Ubuntu (the architecture and distro the docs
CI job uses), installs the dependencies there, and builds the export there too — the Next
production bundle contains platform-specific native code, so a host build is not a valid input.
The container builds into `docs-site/out-linux/`, which is gitignored, so the host's `out/` is
left alone. The image tag is derived from the `@playwright/test` version in the lockfile by
`docs-site/scripts/visual_linux_image.py`, and `//docs-site:visual_tooling_test` fails if that
pin, the platform, or the CI guard below ever drifts.

Review the image diff in the PR before committing the new PNGs. The suite only bootstraps a
missing baseline when `CI` is unset — under CI a missing baseline is a hard failure, so nobody
can land an unreviewed screenshot.

```bash
bazelisk run //docs-site:visual-linux           # compare against the committed baselines
bazelisk test //docs-site:visual_tooling_test   # the guards described above
```


## Leftover MkDocs files

Removed in this change: `mkdocs.yml`, `docs/hooks.py` + `docs/test_hooks.py`,
`docs/test_mkdocs_render.py`/`.sh`, `docs/test_mkdocs_build.sh`, `docs/test_mkdocs_visual.sh`,
`docs/assets/` (`extra.css`, `command-vars.js`/`.css`), `docs/includes/cluster-config.md`, and
the `site/` build output.

Nothing else MkDocs-related is left to delete: `docs/requirements.txt` now pins only pytest,
pytest-cov, and Pillow, and no build step imports MkDocs. If a stale checkout still has
`site/`, `.venv-docs/`, or `.mkdocs-serve-*.yml`, they are build artefacts and can be removed —
they are gitignored.

## Gates, before and after

| Purpose | Was | Now |
| --- | --- | --- |
| Content contract of navigable pages | `//docs:test_mkdocs_render` | `//docs:test_docs_site_render` (in `//:test-fast`) |
| Same checks against the export | (same target) | `bazelisk run //docs:render-check` after `//docs:docs` |
| Widget behaviour | Playwright asserts inside the render test | `//docs-site:unit` (Vitest), `//docs-site:typecheck` |
| Screenshots vs goldens | `//docs:test_mkdocs_visual` | `//docs-site:visual-linux` (Linux container on the CI image); `//docs-site:visual` is `manual` and single-environment only |
| Nav ↔ Bazel page listing | `mkdocs.yml` vs `docs/BUILD.bazel` | `docs-site/lib/nav.json` vs `docs/BUILD.bazel` (`//tests:doc_coverage`) |
| Nav transcriber / codemod units | n/a | `//docs-site:nav_test`, `//docs-site:codemod_test` |
| Python coverage | `generate_shell_docs` + `hooks` | `generate_shell_docs`, the `docs-site` codemod and nav transcriber, plus the golden-image resolver (`//docs:test_python_coverage`) |

No gate was dropped: each MkDocs-era target was retargeted onto the Next app, and the CI
`docs-and-render` job runs the same checks in the same order (fast gates, then export, then
browser).
