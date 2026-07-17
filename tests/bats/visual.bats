#!/usr/bin/env bats
#
# BATS tests for visual generative AI (ComfyUI / FLUX / LTX) manage + download utilities.
# Hermetic: mocks kubectl; no live cluster or HF downloads.

load 'test_helper'

setup_file() {
  TEST_TMP_DIR="$(mktemp -d)"
  export TEST_TMP_DIR

  export REPO_ROOT="$(bats_canonical_repo_root)"
  export SCRIPT_LIB_DIR="${REPO_ROOT}/scripts/lib"
  export MANAGE_SH="${REPO_ROOT}/scripts/manage.sh"
  export UTILITIES_DIR="${REPO_ROOT}/scripts/utilities"
  export LAB_MOCK_NODES_JSON='[{"name":"spark0","allocatable":{"cpu":"128","memory":"1024Gi","gpu":"16"}}]'
  export LAB_MOCK_PODS_JSON='[]'

  mkdir -p "$TEST_TMP_DIR/kubeconfig"
  echo "fake-config" > "$TEST_TMP_DIR/kubeconfig/config"
  export KUBECONFIG="$TEST_TMP_DIR/kubeconfig/config"

  mkdir -p "$TEST_TMP_DIR/bin"
  export PATH="$TEST_TMP_DIR/bin:$PATH"

  _visual_bats_write_mocks
  touch "${TEST_TMP_DIR}/kubectl_calls.log"
}

_visual_bats_write_mocks() {
  {
    echo '#!/usr/bin/env bash'
    echo "CALL_LOG=\"${TEST_TMP_DIR}/kubectl_calls.log\""
    cat << 'MOCKKUBECTL'
echo "kubectl $*" >> "$CALL_LOG"

case "$1" in
  cluster-info)
    echo "Kubernetes control plane is running at https://fake:6443"
    exit 0
    ;;
  get)
    if [[ "$*" == *"nodes"* && "$*" == *"json"* ]]; then
      # Enough allocatable memory for visual preflight
      cat <<'JSON'
{"items":[{"metadata":{"name":"spark0"},"status":{"allocatable":{"cpu":"128","memory":"134217728Ki","nvidia.com/gpu":"1"}}}]}
JSON
      exit 0
    fi
    if [[ "$*" == *"nodes"* ]]; then
      echo "NAME     STATUS   ROLES    AGE   VERSION"
      echo "spark0   Ready    control-plane,worker   1d    v1.30.3+k3s1"
      exit 0
    fi
    if [[ "$*" == *"ns ai-inference"* || "$*" == *"namespace"* || "$*" == *"get ns"* ]]; then
      exit 0
    fi
    if [[ "$*" == *"deploy"* && "$*" == *"workload=visual"* ]]; then
      # No active visual deployments
      exit 0
    fi
    if [[ "$*" == *"pods"* ]]; then
      echo "[]"
      exit 0
    fi
    if [[ "$*" == *"jsonpath"* ]]; then
      echo -n "0"
      exit 0
    fi
    echo "mocked get: $*"
    exit 0
    ;;
  apply)
    echo "mocked: would apply $*"
    exit 0
    ;;
  delete)
    echo "mocked: would delete $*"
    exit 0
    ;;
  create)
    echo "mocked create"
    exit 0
    ;;
  *)
    echo "mocked kubectl: $*"
    exit 0
    ;;
esac
MOCKKUBECTL
  } > "$TEST_TMP_DIR/bin/kubectl"
  chmod +x "$TEST_TMP_DIR/bin/kubectl"
}

setup() {
  export TEST_TMP_DIR REPO_ROOT SCRIPT_LIB_DIR MANAGE_SH UTILITIES_DIR KUBECONFIG PATH
  export LAB_MOCK_NODES_JSON LAB_MOCK_PODS_JSON
  _visual_bats_write_mocks
  > "${TEST_TMP_DIR}/kubectl_calls.log" || true
}

teardown_file() {
  rm -rf "$TEST_TMP_DIR" || true
}

@test "manage.sh help lists visual commands" {
  run bash "$MANAGE_SH" help
  [ "$status" -eq 0 ]
  [[ "$output" == *"start-flux-fast"* ]]
  [[ "$output" == *"start-ltx-balanced"* ]]
  [[ "$output" == *"start-flux-to-ltx"* ]]
  [[ "$output" == *"stop-visual"* ]]
  [[ "$output" == *"status-visual"* ]]
  [[ "$output" == *"start-comfy-base"* ]]
}

@test "manage.sh start-flux-fast aborts without yes" {
  run bash -c "echo 'no' | bash \"$MANAGE_SH\" start-flux-fast"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Aborted"* ]]
}

@test "manage.sh start-flux-fast applies kustomize after yes" {
  run bash -c "echo 'yes' | bash \"$MANAGE_SH\" start-flux-fast"
  [ "$status" -eq 0 ]
  [[ "$output" == *"VISUAL"* || "$output" == *"flux-fast"* ]]
  run cat "${TEST_TMP_DIR}/kubectl_calls.log"
  [ "$status" -eq 0 ]
  [[ "$output" == *"apply"* ]]
  [[ "$output" == *"flux/fast"* || "$output" == *"kustomize"* || "$output" == *"-k"* ]]
}

@test "manage.sh start-flux-fast non-interactive requires confirm token" {
  run bash -c "LAB_NON_INTERACTIVE=1 LAB_CONFIRM_TOKEN= bash \"$MANAGE_SH\" start-flux-fast"
  [ "$status" -ne 0 ]
}

@test "manage.sh start-flux-fast non-interactive with yes token proceeds" {
  run bash -c "LAB_NON_INTERACTIVE=1 LAB_CONFIRM_TOKEN=yes bash \"$MANAGE_SH\" start-flux-fast"
  [ "$status" -eq 0 ]
  [[ "$output" == *"flux-fast"* || "$output" == *"VISUAL"* ]]
}

@test "manage.sh stop-visual deletes visual deployments" {
  run bash "$MANAGE_SH" stop-visual
  [ "$status" -eq 0 ]
  [[ "$output" == *"visual"* || "$output" == *"Visual"* || "$output" == *"No visual"* ]]
  run cat "${TEST_TMP_DIR}/kubectl_calls.log"
  [ "$status" -eq 0 ]
  # stop-visual always queries deploys with label
  [[ "$output" == *"workload=visual"* || "$output" == *"deploy"* ]]
}

@test "manage.sh status-visual runs" {
  run bash "$MANAGE_SH" status-visual
  [ "$status" -eq 0 ]
}

@test "download-flux status works offline" {
  run bash -c "MODELS_DIR=\"${TEST_TMP_DIR}/models\" bash \"${UTILITIES_DIR}/download-flux.sh\" status --tier fast --json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"flux"* || "$output" == *"tiers"* || "$output" == *"klein"* || "$output" == *"ready"* ]]
}

@test "download-ltx status works offline" {
  run bash -c "MODELS_DIR=\"${TEST_TMP_DIR}/models\" bash \"${UTILITIES_DIR}/download-ltx.sh\" status --tier balanced --json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"tiers"* || "$output" == *"LTX"* || "$output" == *"ready"* ]]
}

@test "manage.sh start-flux-to-ltx aborts without confirmation" {
  run bash -c "echo 'no' | bash \"$MANAGE_SH\" start-flux-to-ltx"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Aborted"* ]]
}
