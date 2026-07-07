#!/usr/bin/env bash
# Hermetic documentation coverage gate — enforces docs/project-conventions.md §11.
set -euo pipefail

ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT"
exec python3 "$ROOT/tests/doc_coverage.py"