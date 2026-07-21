#!/usr/bin/env bash
# Hermetic kustomize build smoke test for all overlays.
# Verifies workload kustomization.yaml files and overlay patches compose cleanly.
set -euo pipefail

# @function stage_k8s_tree
# Copy k8s overlays and workload trees into a temp directory for hermetic tests.
# @param $1  Destination directory.

stage_k8s_tree() {
  local dest="$1"
  mkdir -p "${dest}/k8s/workloads"
  # Materialize declared runfiles (cp -R follows symlinks into the sandbox).
  cp -RL "${TEST_SRCDIR}/_main/k8s/overlays" "${dest}/k8s/"
  cp -RL "${TEST_SRCDIR}/_main/k8s/workloads/kimi-test" "${dest}/k8s/workloads/"
  cp -RL "${TEST_SRCDIR}/_main/k8s/workloads/kimi" "${dest}/k8s/workloads/"
}

if [[ -n ${TEST_SRCDIR:-} ]]; then
  WORK="$(mktemp -d)"
  trap 'rm -rf "${WORK}"' EXIT
  stage_k8s_tree "${WORK}"
  ROOT="${WORK}"
else
  ROOT="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
fi
cd "${ROOT}"

# @function kustomize_build_dir
# Run kustomize build or kubectl kustomize on a directory.
# @param $1  Kustomize directory path.

kustomize_build_dir() {
  local dir="$1"
  if command -v kustomize >/dev/null 2>&1; then
    kustomize build "${dir}"
  elif command -v kubectl >/dev/null 2>&1; then
    kubectl kustomize "${dir}"
  else
    echo "ERROR: neither kustomize nor kubectl found on PATH" >&2
    exit 1
  fi
}

OVERLAYS=(test prod single-node)

for overlay in "${OVERLAYS[@]}"; do
  dir="k8s/overlays/${overlay}"
  echo "→ kustomize build ${dir}"
  out="$(kustomize_build_dir "${dir}")"
  if [[ -z ${out} ]]; then
    echo "ERROR: empty output from kustomize build ${dir}" >&2
    exit 1
  fi
  echo "  ok ($(echo "${out}" | grep -c '^kind:' || true) resources)"
done

echo "All overlay kustomize builds succeeded."
