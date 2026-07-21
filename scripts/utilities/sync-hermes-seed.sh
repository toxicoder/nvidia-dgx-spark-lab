#!/usr/bin/env bash
#
# ## sync-hermes-seed — copy Hermes workspace-dev profile into Coder template seed
#
# Keeps `hermes/profiles/workspace-dev/` as the single source of truth and
# mirrors tracked files into `k8s/dev/templates/coder-spark-lab/hermes-seed/`.
#
# Usage:
#   bazelisk run //scripts:run-utility -- sync-hermes-seed
#   ./scripts/utilities/sync-hermes-seed.sh
#
# @command sync-hermes-seed
# @description Sync Hermes workspace-dev profile files into the Coder spark-lab template seed directory.

set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(lab_script_dir 1 utilities)/../.." && pwd)}"
SRC="${ROOT}/hermes/profiles/workspace-dev"
DEST="${ROOT}/k8s/dev/templates/coder-spark-lab/hermes-seed"

if [[ ! -d $SRC ]]; then
  echo "sync-hermes-seed: source profile missing: $SRC" >&2
  exit 1
fi

mkdir -p "$DEST"

for name in config.yaml distribution.yaml mcp.json SOUL.md; do
  if [[ ! -f "${SRC}/${name}" ]]; then
    echo "sync-hermes-seed: missing ${SRC}/${name}" >&2
    exit 1
  fi
  cp "${SRC}/${name}" "${DEST}/${name}"
  echo "sync-hermes-seed: ${name}"
done

echo "sync-hermes-seed: done → ${DEST}"
