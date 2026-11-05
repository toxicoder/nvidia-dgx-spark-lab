#!/usr/bin/env bash
# Bazel file-coverage gate — every tracked file is owned by an explicit Bazel rule.
# See docs/project-conventions.md §15 and tests/bazel_file_coverage.py.
set -euo pipefail

ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT"
exec python3 "$ROOT/tests/bazel_file_coverage.py"
