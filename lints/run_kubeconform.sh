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

# Validate Kubernetes API manifests only. kustomization.yaml is a Kustomize
# config type (not a cluster API schema) — exclude it. Only search trees that exist.
dirs=()
[[ -d k8s ]] && dirs+=(k8s)
[[ -d mcp/k8s ]] && dirs+=(mcp/k8s)
if [[ ${#dirs[@]} -eq 0 ]]; then
  echo "No k8s manifest directories found under ${ROOT}" >&2
  exit 1
fi

find "${dirs[@]}" \
  \( -name '*.yaml' -o -name '*.yml' \) \
  ! -name 'kustomization.yaml' \
  ! -name 'kustomization.yml' \
  -print0 |
  xargs -0 kubeconform -strict -summary -kubernetes-version 1.30.0
echo "K8s schema validation passed."
