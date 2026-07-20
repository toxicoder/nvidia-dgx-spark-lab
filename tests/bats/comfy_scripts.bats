#!/usr/bin/env bats
#
# Hermetic tests for comfy-base container scripts (install/run + Spark patch).
# Scripts live under k8s/workloads/comfy-base/scripts/ and are mounted via
# kustomize configMapGenerator (not inline ConfigMap YAML).

load 'test_helper'

setup_file() {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  export COMFY_SCRIPTS="${REPO_ROOT}/k8s/workloads/comfy-base/scripts"
  export COMFY_BASE="${REPO_ROOT}/k8s/workloads/comfy-base"
  export PATCH_PY="${COMFY_SCRIPTS}/patch_get_free_memory.py"
}

@test "install-comfy.sh and run-comfy.sh exist as standalone files" {
  [ -f "${COMFY_SCRIPTS}/install-comfy.sh" ]
  [ -f "${COMFY_SCRIPTS}/run-comfy.sh" ]
  [ -f "${PATCH_PY}" ]
}

@test "install-comfy.sh and run-comfy.sh pass bash -n" {
  run bash -n "${COMFY_SCRIPTS}/install-comfy.sh"
  [ "$status" -eq 0 ]
  run bash -n "${COMFY_SCRIPTS}/run-comfy.sh"
  [ "$status" -eq 0 ]
}

@test "run-comfy.sh fails when venv python is missing" {
  run bash -c "COMFY_HOME=/tmp/comfy-missing-venv-$$ bash \"${COMFY_SCRIPTS}/run-comfy.sh\""
  [ "$status" -ne 0 ]
  [[ "$output" == *"venv missing"* || "$output" == *"ERROR"* ]]
}

@test "kustomization uses configMapGenerator with disableNameSuffixHash" {
  run grep -q 'configMapGenerator' "${COMFY_BASE}/kustomization.yaml"
  [ "$status" -eq 0 ]
  run grep -q 'disableNameSuffixHash' "${COMFY_BASE}/kustomization.yaml"
  [ "$status" -eq 0 ]
  run grep -q 'scripts/install-comfy.sh' "${COMFY_BASE}/kustomization.yaml"
  [ "$status" -eq 0 ]
  run grep -q 'scripts/patch_get_free_memory.py' "${COMFY_BASE}/kustomization.yaml"
  [ "$status" -eq 0 ]
}

@test "kustomize build emits stable ConfigMaps with script keys" {
  if ! command -v kustomize >/dev/null 2>&1 && ! command -v kubectl >/dev/null 2>&1; then
    skip "neither kustomize nor kubectl available"
  fi
  if command -v kustomize >/dev/null 2>&1; then
    run kustomize build "${COMFY_BASE}"
  else
    run kubectl kustomize "${COMFY_BASE}"
  fi
  [ "$status" -eq 0 ]
  [[ "$output" == *"name: comfy-base-scripts"* ]]
  [[ "$output" == *"name: comfy-base-spark-patches"* ]]
  # No hash suffix on generated names
  [[ "$output" != *"comfy-base-scripts-"* ]]
  [[ "$output" != *"comfy-base-spark-patches-"* ]]
  [[ "$output" == *"install-comfy.sh"* ]]
  [[ "$output" == *"run-comfy.sh"* ]]
  [[ "$output" == *"patch_get_free_memory.py"* ]]
  [[ "$output" == *"LAB_SPARK_UNIFIED_MEMORY_PATCH"* ]]
}

@test "patch_get_free_memory.py skips missing model_management.py" {
  tmp="$(mktemp -d)"
  run python3 "${PATCH_PY}" "${tmp}"
  [ "$status" -eq 0 ]
  [[ "$output" == *"skip"* || "$output" == *"missing"* ]]
  rm -rf "${tmp}"
}

@test "patch_get_free_memory.py applies primary mem_get_info pattern" {
  tmp="$(mktemp -d)"
  mkdir -p "${tmp}/comfy"
  cat >"${tmp}/comfy/model_management.py" <<'PY'
def get_free_memory(dev):
    mem_free_cuda, _ = torch.cuda.mem_get_info(dev)
    return mem_free_cuda
PY
  run python3 "${PATCH_PY}" "${tmp}"
  [ "$status" -eq 0 ]
  [[ "$output" == *"applied"* ]]
  run grep -q 'LAB_SPARK_UNIFIED_MEMORY_PATCH' "${tmp}/comfy/model_management.py"
  [ "$status" -eq 0 ]
  run grep -q 'virtual_memory().available' "${tmp}/comfy/model_management.py"
  [ "$status" -eq 0 ]
  # Original pattern should be gone
  run grep -q 'torch.cuda.mem_get_info(dev)' "${tmp}/comfy/model_management.py"
  [ "$status" -ne 0 ]
  rm -rf "${tmp}"
}

@test "patch_get_free_memory.py is idempotent" {
  tmp="$(mktemp -d)"
  mkdir -p "${tmp}/comfy"
  cat >"${tmp}/comfy/model_management.py" <<'PY'
def get_free_memory(dev):
    mem_free_cuda, _ = torch.cuda.mem_get_info(dev)
    return mem_free_cuda
PY
  python3 "${PATCH_PY}" "${tmp}"
  first="$(cat "${tmp}/comfy/model_management.py")"
  run python3 "${PATCH_PY}" "${tmp}"
  [ "$status" -eq 0 ]
  [[ "$output" == *"already applied"* ]]
  second="$(cat "${tmp}/comfy/model_management.py")"
  [ "$first" = "$second" ]
  rm -rf "${tmp}"
}

@test "patch_get_free_memory.py handles alternate mem_get_info pattern" {
  tmp="$(mktemp -d)"
  mkdir -p "${tmp}/comfy"
  cat >"${tmp}/comfy/model_management.py" <<'PY'
def get_free_memory(dev):
    mem_free_total, mem_free_torch = torch.cuda.mem_get_info(dev)
    return mem_free_total
PY
  run python3 "${PATCH_PY}" "${tmp}"
  [ "$status" -eq 0 ]
  [[ "$output" == *"applied"* ]]
  run grep -q 'LAB_SPARK_UNIFIED_MEMORY_PATCH' "${tmp}/comfy/model_management.py"
  [ "$status" -eq 0 ]
  rm -rf "${tmp}"
}

@test "patch_get_free_memory.py soft-skips unknown ComfyUI drift" {
  tmp="$(mktemp -d)"
  mkdir -p "${tmp}/comfy"
  cat >"${tmp}/comfy/model_management.py" <<'PY'
def get_free_memory(dev):
    return 0  # no mem_get_info pattern
PY
  run python3 "${PATCH_PY}" "${tmp}"
  [ "$status" -eq 0 ]
  [[ "$output" == *"WARNING"* || "$output" == *"skipped"* || "$output" == *"drift"* ]]
  # File unchanged
  run grep -q 'return 0' "${tmp}/comfy/model_management.py"
  [ "$status" -eq 0 ]
  run grep -q 'LAB_SPARK_UNIFIED_MEMORY_PATCH' "${tmp}/comfy/model_management.py"
  [ "$status" -ne 0 ]
  rm -rf "${tmp}"
}
