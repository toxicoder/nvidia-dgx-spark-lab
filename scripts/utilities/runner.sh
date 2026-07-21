#!/usr/bin/env bash
#
# ## Utility runner (Bazel entry)
#
# Dispatches to `scripts/utilities/<name>.sh` for dashboard-controllable utilities.
#
# @command run-utility
# Usage:
#   bazelisk run //scripts:run-utility -- spark-clock status
#   bazelisk run //scripts:run-utility -- nemotron-stack run
# Safety:
#   Only invokes scripts under scripts/utilities/; allowlist enforced by each utility.
set -euo pipefail
# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
SCRIPT_DIR="$(lab_script_dir 1 utilities)"
UTIL="$1"
shift || true
exec "${SCRIPT_DIR}/${UTIL}.sh" "$@"
