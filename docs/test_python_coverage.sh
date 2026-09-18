#!/usr/bin/env bash
# Enforce 100% line coverage on the docs Python tooling.
#
# The site itself is the Node app in docs-site/ (its suites are //docs-site:unit plus the
# Vitest half of //docs:test_command_vars); what is still Python is the shell-doc extractor
# that fills docs/generated/shell/reference.md, which operators ship verbatim, plus the nav
# transcriber, the MkDocs-to-MDX codemod and the Linux golden-image resolver.
#
# Every module named with --cov= below has to be importable when the run starts: coverage
# silently collects nothing for a module it never sees, which would let this gate report 100%
# while measuring a single file.  The scripts directories therefore go on PYTHONPATH and the
# modules are named bare, and the report is then checked to contain a row per expected module
# so a slip back into vacuous measurement fails loudly instead of looking green.
set -euo pipefail

ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT"

PY="${PYTHON:-python3}"

if ! "$PY" -c "import pytest, pytest_cov" 2>/dev/null; then
  echo "test_python_coverage: install pytest and pytest-cov (pip install pytest pytest-cov)" >&2
  exit 1
fi

MEASURED=(
  generate_shell_docs
  codemod_mkdocs_to_mdx
  gen_nav
  visual_linux_image
)

cov_args=()
for module in "${MEASURED[@]}"; do
  cov_args+=("--cov=${module}")
done

report_file="$(mktemp "${TMPDIR:-/tmp}/docs-python-coverage.XXXXXX")"
trap 'rm -f "$report_file"' EXIT

cd "$ROOT/docs"
PYTHONPATH="$ROOT/docs-site/scripts:$ROOT/docs-site${PYTHONPATH:+:$PYTHONPATH}" \
  "$PY" -m pytest \
  test_generate_shell_docs.py \
  ../docs-site/test_codemod.py \
  ../docs-site/test_gen_nav.py \
  ../docs-site/test_visual_tooling.py \
  "${cov_args[@]}" \
  --cov-report=term-missing \
  --cov-fail-under=100 \
  -q |
  tee "$report_file"

# A module that was never imported produces no row at all, so checking for the row is what
# proves the percentage below covers the whole tooling rather than one generator.
missing=()
for module in "${MEASURED[@]}"; do
  if ! grep -q "${module}" "$report_file"; then
    missing+=("$module")
  fi
done
if ((${#missing[@]} > 0)); then
  printf 'test_python_coverage: never measured %s (not importable from the run root?)\n' \
    "${missing[*]}" >&2
  exit 1
fi

echo "test_python_coverage: 100% on docs Python modules (${MEASURED[*]})"
