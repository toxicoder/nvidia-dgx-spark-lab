#!/usr/bin/env bash
# ## flags_registry - gate the checked-in feature-flag registry
#
# Validates config/flags.yaml against docs/branching.md: every flag declares a default,
# an owner, an expiry and one reader, and nothing that is not a shipped capability
# defaults on. Diagnostics go to stderr so they survive a `bazelisk test` capture.
#
# Usage: bazelisk test //tests:flags_registry
set -euo pipefail

ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT"
exec python3 "$ROOT/tests/flags_registry.py"
