#!/usr/bin/env bash
#
# //:fix - Run all trusted formatters and auto-fixable linters.
#
# This target programmatically fixes what can be fixed using only
# well-trusted, widely-used software:
#   - buildifier (Bazel official)
#   - shfmt (mvdan/sh - de-facto shell formatter)
#   - ruff (astral-sh - current gold standard for Python lint+format)
#   - prettier (standard for JS/TS/MD/YAML/JSON, already in our devcontainer)
#
# Usage:
#   bazelisk run //:fix
#
# It is deliberately non-hermetic (same model as our existing lint targets)
# and expects the tools to be in $PATH (see devcontainer and install scripts).

set -euo pipefail

ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
cd "$ROOT"

echo "→ Running trusted formatters + auto-fix linters (//:fix)"

# 1. Bazel BUILD files and .bzl (buildifier -mode=fix is the canonical way)
if command -v buildifier >/dev/null 2>&1; then
  echo "   buildifier -mode=fix"
  # Collect files we actually own (avoid bazel- cache dirs, generated site, venvs, node_modules)
  find . -type f \( -name 'BUILD*' -o -name '*.bzl' \) \
    ! -path '*/bazel-*/*' \
    ! -path './site/*' \
    ! -path './.venv*' \
    ! -path './node_modules/*' \
    ! -path './bazel-bin/*' \
    ! -path './bazel-out/*' \
    -print0 | xargs -0 -r buildifier -mode=fix || true  # keep: fix step (formatter, not real lint/check); tolerate no-op or tool quirks for ops
else
  echo "   (buildifier not in PATH - skipping)"
fi

# 2. Shell scripts (shfmt is the trusted auto-formatter; shellcheck has no reliable auto-fix)
if command -v shfmt >/dev/null 2>&1; then
  echo "   shfmt -w -s -i 2 -ci"
  find . -name '*.sh' \
    ! -path '*/bazel-*/*' \
    ! -path './site/*' \
    ! -path './.venv*' \
    ! -path './node_modules/*' \
    ! -path './bazel-bin/*' \
    ! -path './bazel-out/*' \
    -print0 | xargs -0 -r shfmt -w -s -i 2 -ci || true  # keep: fix step (formatter, not real lint/check); tolerate no-op or tool quirks for ops
else
  echo "   (shfmt not in PATH - skipping)"
fi

# 3. Python (docs/ tooling + any root .py used by Bazel)
if command -v ruff >/dev/null 2>&1; then
  echo "   ruff format + ruff check --fix"
  # Only touch files we control
  for py_dir in docs mcp config/grafana tests; do
    if [ -d "$ROOT/$py_dir" ]; then
      ruff format "$ROOT/$py_dir" 2>/dev/null || true  # keep: fix step (formatter, not real lint/check); tolerate no-op or tool quirks for ops
      ruff check --fix "$ROOT/$py_dir" 2>/dev/null || true  # keep: fix step (formatter, not real lint/check); tolerate no-op or tool quirks for ops
    fi
  done
  # Also any top-level Python used for build (keep small)
  for f in *.py; do
    [ -f "$f" ] && ruff format "$f" 2>/dev/null || true  # keep: fix step (formatter, not real lint/check); tolerate no-op or tool quirks for ops
    [ -f "$f" ] && ruff check --fix "$f" 2>/dev/null || true  # keep: fix step (formatter, not real lint/check); tolerate no-op or tool quirks for ops
  done
else
  echo "   (ruff not in PATH - skipping)"
fi

# 4. YAML (repo-wide: k8s, ansible, helm, CI workflows, mkdocs, etc.)
if [ -f "$ROOT/scripts/yaml_format.sh" ]; then
  echo "   prettier --write (YAML, repo-wide)"
  bash "$ROOT/scripts/yaml_format.sh" --write 2>/dev/null || true  # keep: fix step (formatter, not real lint/check); tolerate no-op or tool quirks for ops
else
  echo "   (scripts/yaml_format.sh missing - skipping YAML format)"
fi

if command -v yamllint >/dev/null 2>&1; then
  echo "   yamllint (YAML lint)"
  yamllint -c "$ROOT/.yamllint.yml" "$ROOT" 2>/dev/null || true  # keep: post-format lint in fix; tolerate when tree not fully clean yet
else
  echo "   (yamllint not in PATH - skipping YAML lint)"
fi

# 5. Dashboard (Next.js/TS/JS + Markdown/JSON via prettier)
if [ -d dashboard ]; then
  if command -v npx >/dev/null 2>&1; then
    echo "   prettier --write (dashboard)"
    (cd dashboard && npx prettier --write . --ignore-unknown 2>/dev/null || true)  # keep: fix step (formatter, not real lint/check); tolerate no-op or tool quirks for ops

    # eslint --fix via Next's lint script (if available)
    if [ -f dashboard/package.json ] && grep -q '"lint"' dashboard/package.json; then
      echo "   npm run lint -- --fix (dashboard)"
      (cd dashboard && npm run lint -- --fix 2>/dev/null || true)  # keep: fix step (formatter/ auto-fix, not real lint/check); tolerate for ops
    fi
  else
    echo "   (npx not in PATH - skipping prettier/eslint for dashboard)"
  fi
fi

echo ""
echo "✓ //:fix complete"
echo ""
echo "Reminder: pure linters (shellcheck, kubeconform) have no safe auto-fix mode."
echo "YAML is formatted with prettier and linted with yamllint in //:fix; re-check with:"
echo "  bazelisk test //:lint --test_tag_filters=manual"
echo ""
echo "See docs/BUILDING_WITH_BAZEL.md and docs/project-conventions.md for the recommended workflow."