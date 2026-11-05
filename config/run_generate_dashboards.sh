#!/usr/bin/env bash
# ## Regenerate the Grafana dashboards from their single Python source.
#
# Owns the generator behind a Bazel target so operators never call the script
# directly. Writes JSON into config/grafana/dashboards/, which
# //config:grafana_dashboards then exposes to the test and deployment targets.
#
# Usage: bazelisk run //config:generate-dashboards
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n ${BUILD_WORKSPACE_DIRECTORY:-} ]]; then
  ROOT="${BUILD_WORKSPACE_DIRECTORY}"
elif [[ -n ${TEST_SRCDIR:-} ]]; then
  ROOT="${TEST_SRCDIR}/_main"
else
  ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
fi

GEN="${ROOT}/config/grafana/generate-dashboards.py"
if [[ ! -f ${GEN} ]]; then
  echo "generate-dashboards: missing ${GEN}" >&2
  exit 1
fi

echo "generate-dashboards: rendering dashboards from config/grafana" >&2
python3 "${GEN}"
echo "generate-dashboards: done" >&2
