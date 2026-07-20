#!/usr/bin/env bash
# Thin wrapper — implementation lives in scripts/ci (Bazel-visible, multi-arch).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec bash "${ROOT}/scripts/ci/install-lint-tools.sh" "$@"
