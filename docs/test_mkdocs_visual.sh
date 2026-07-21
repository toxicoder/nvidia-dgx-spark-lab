#!/usr/bin/env bash
# MkDocs visual golden test only (Playwright screenshots vs committed goldens).
set -euo pipefail
export MKDOCS_TEST_MODE=visual
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/test_mkdocs_render.sh" "$@"
