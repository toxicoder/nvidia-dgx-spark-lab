#!/usr/bin/env bash
# Run command-vars pure unit tests (and Playwright when site tools exist).
set -euo pipefail

ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT/docs"

# Pure logic always runs. Playwright class self-skips without mkdocs/chromium.
python3 -m unittest test_command_vars -v
