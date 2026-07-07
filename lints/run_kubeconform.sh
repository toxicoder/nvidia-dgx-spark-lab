#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${BUILD_WORKSPACE_DIRECTORY:-}" ]]; then
  ROOT="${BUILD_WORKSPACE_DIRECTORY}"
elif [[ -n "${TEST_SRCDIR:-}" ]]; then
  ROOT="${TEST_SRCDIR}/_main"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
source "$ROOT/scripts/lib/check_tool.sh"

check_tool kubeconform "curl download from https://github.com/yannh/kubeconform"
cd "$ROOT"

echo "Running kubeconform..."
kubeconform -v
find k8s mcp/k8s \( -name '*.yaml' -o -name '*.yml' \) -print0 | xargs -0 kubeconform -strict -summary -kubernetes-version 1.30.0  # hardened: removed || echo; real k8s lint/check will now fail on schema violations
echo "K8s schema validation passed."
