#!/usr/bin/env bash
# Fast MkDocs render test: strict build + HTML/source checks (no Playwright).
set -euo pipefail
export MKDOCS_TEST_MODE=build
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/test_mkdocs_render.sh" "$@"