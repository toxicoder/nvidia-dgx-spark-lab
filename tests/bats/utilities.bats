#!/usr/bin/env bats
#
# Hermetic tests for scripts/utilities/*.sh status/run contract.

load 'test_helper'

setup_file() {
  TEST_TMP_DIR="$(mktemp -d)"
  export TEST_TMP_DIR

  export REPO_ROOT="$(bats_canonical_repo_root)"
  # Run real repo scripts so kcov attributes hits to scripts/**/*.sh (not /tmp copies).
  UTILITIES_DIR="${REPO_ROOT}/scripts/utilities"
  export UTILITIES_DIR

  export HOME="$TEST_TMP_DIR/home"
  mkdir -p "$HOME/.ollama/models"
  export REMOTE_HOST="192.168.100.2"
  export LAB_MOCK_NODES_JSON='[{"name":"spark0","allocatable":{"cpu":"128","memory":"1024Gi","gpu":"16"}}]'
  export LAB_MOCK_PODS_JSON='[]'

  mkdir -p "$TEST_TMP_DIR/kubeconfig"
  echo "fake-config" > "$TEST_TMP_DIR/kubeconfig/config"
  export KUBECONFIG="$TEST_TMP_DIR/kubeconfig/config"

  mkdir -p "$TEST_TMP_DIR/bin"
  export PATH="$TEST_TMP_DIR/bin:$PATH"

  cat > "$TEST_TMP_DIR/bin/du" << 'MOCKDU'
#!/usr/bin/env bash
echo "0B"
MOCKDU
  chmod +x "$TEST_TMP_DIR/bin/du"

  # Mock nvidia-smi for spark-clock (MOCK_SPARK_CLOCK_MODE: healthy|unlocked|pd_degraded)
  export MOCK_SPARK_CLOCK_MODE="${MOCK_SPARK_CLOCK_MODE:-healthy}"
  cat > "$TEST_TMP_DIR/bin/nvidia-smi" << 'MOCKNVIDIA'
#!/usr/bin/env bash
mode="${MOCK_SPARK_CLOCK_MODE:-healthy}"

gpu_row() {
  case "$mode" in
    unlocked)
      echo "208, [N/A], 3003, 2418, 45, 55, 7.0, 0, Not Active, Not Active, 0, 0, 0, Enabled"
      ;;
    pd_degraded)
      echo "513, 300, 2200, 2418, 44, 50, 14.5, 96, Not Active, Active, 1369000000, 0, 0, Enabled"
      ;;
    healthy|*)
      # Idle GPU with lock range 300-2200 already applied
      echo "208, 300, 2200, 2418, 68, 42, 7.0, 0, Not Active, Active, 0, 0, 0, Enabled"
      ;;
  esac
}

case "$*" in
  *--query-gpu=*clocks.current.graphics*)
    gpu_row
    ;;
  *clocks.current.graphics*)
    gpu_row
    ;;
  *clocks.max.graphics*)
    echo "3003"
    ;;
  *-q*)
    if [[ "$mode" == "unlocked" ]]; then
      echo "Applications Clocks Setting : Not Active"
    else
      echo "Applications Clocks Setting : Active"
    fi
    echo "Persistence Mode : Enabled"
    ;;
  *-lgc*|-pm*|-rgc*)
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
MOCKNVIDIA
  chmod +x "$TEST_TMP_DIR/bin/nvidia-smi"

  # Mock rsync + ssh for sync-ollama-models
  cat > "$TEST_TMP_DIR/bin/rsync" << 'MOCKRSYNC'
#!/usr/bin/env bash
if [[ "$*" == *"--dry-run"* ]]; then
  echo "sent 0 bytes  received 0 bytes"
  exit 0
fi
echo "rsync complete"
exit 0
MOCKRSYNC
  chmod +x "$TEST_TMP_DIR/bin/rsync"

  cat > "$TEST_TMP_DIR/bin/ssh" << 'MOCKSSH'
#!/usr/bin/env bash
exit 0
MOCKSSH
  chmod +x "$TEST_TMP_DIR/bin/ssh"

  # Mock apt + fwupdmgr + sudo for system-update
  cat > "$TEST_TMP_DIR/bin/apt" << 'MOCKAPT'
#!/usr/bin/env bash
exit 0
MOCKAPT
  chmod +x "$TEST_TMP_DIR/bin/apt"

  cat > "$TEST_TMP_DIR/bin/fwupdmgr" << 'MOCKFW'
#!/usr/bin/env bash
exit 0
MOCKFW
  chmod +x "$TEST_TMP_DIR/bin/fwupdmgr"

  cat > "$TEST_TMP_DIR/bin/sudo" << 'MOCKSUDO'
#!/usr/bin/env bash
# Strip sudo flags (e.g. -n) so spark-clock require_root checks pass in tests.
args=()
for arg in "$@"; do
  [[ "$arg" == "-n" || "$arg" == "-E" ]] && continue
  args+=("$arg")
done
exec "${args[@]}"
MOCKSUDO
  chmod +x "$TEST_TMP_DIR/bin/sudo"

  # Mock kubectl (pattern from manage.bats; extended for utility status probes)
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
    if [[ "$*" == *"nodes"* ]]; then
      echo "NAME     STATUS   ROLES    AGE   VERSION"
      echo "spark0   Ready    control-plane,worker   1d    v1.30.3+k3s1"
      echo "spark1   Ready    worker                 1d    v1.30.3+k3s1"
      exit 0
    fi
    if [[ "$*" == *"ns ai-inference"* || "$*" == *"ns coder"* || "$*" == *"ns kasm"* || "$*" == *"ns monitoring"* || "$*" == *"ns dev"* ]]; then
      exit 0
    fi
    if [[ "$*" == *"get jobs,pods"* ]]; then
      exit 0
    fi
    if [[ "$*" == *"-n ai-inference"* && "$*" == *"pods"* ]]; then
      echo "No resources found in ai-inference namespace."
      exit 0
    fi
    if [[ "$*" == *"-n coder"* && "$*" == *"pods"* ]]; then
      echo "No resources found in coder namespace."
      exit 0
    fi
    if [[ "$*" == *"-n kasm"* && "$*" == *"pods"* ]]; then
      echo "No resources found in kasm namespace."
      exit 0
    fi
    if [[ "$*" == *"get job"* && "$*" == *"-o json"* ]]; then
      echo '{"apiVersion":"batch/v1","kind":"Job","status":{"active":0,"succeeded":0,"failed":0}}'
      exit 0
    fi
    if [[ "$*" == *"get deployment"* && "$*" == *"-o json"* ]]; then
      echo '{"apiVersion":"apps/v1","kind":"Deployment","status":{"readyReplicas":0}}'
      exit 0
    fi
    if [[ "$*" == *"get job kimi"* ]]; then
      if [[ "$*" == *"jsonpath"* ]]; then
        echo -n "0"
        exit 0
      fi
      exit 1
    fi
    if [[ "$*" == *"get job"* ]]; then
      exit 0
    fi
    if [[ "$*" == *"secret lab-dashboard-secrets"* ]]; then
      exit 1
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
  wait)
    echo "mocked wait"
    exit 0
    ;;
  describe)
    echo "nvidia.com/gpu: 8"
    exit 0
    ;;
  create)
    echo "mocked create ns"
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

  {
    echo '#!/usr/bin/env bash'
    echo "CALL_LOG=\"${TEST_TMP_DIR}/kubectl_calls.log\""
    cat << 'MOCKHELM'
echo "helm $*" >> "$CALL_LOG"
case "$1" in
  repo|list|ls) exit 0 ;;
  upgrade|install) echo "mocked: would helm upgrade/install $*"; exit 0 ;;
  uninstall) echo "mocked: would helm uninstall $*"; exit 0 ;;
  *) echo "mocked helm: $*"; exit 0 ;;
esac
MOCKHELM
  } > "$TEST_TMP_DIR/bin/helm"
  chmod +x "$TEST_TMP_DIR/bin/helm"

  touch "${TEST_TMP_DIR}/kubectl_calls.log"
}

setup() {
  export TEST_TMP_DIR UTILITIES_DIR REPO_ROOT HOME KUBECONFIG PATH REMOTE_HOST
  export LAB_MOCK_NODES_JSON LAB_MOCK_PODS_JSON
  export MOCK_SPARK_CLOCK_MODE="${MOCK_SPARK_CLOCK_MODE:-healthy}"
  > "${TEST_TMP_DIR}/kubectl_calls.log" || true
}

teardown_file() {
  rm -rf "$TEST_TMP_DIR" || true
}

@test "spark-clock.sh status exits 0 and reports utility pattern" {
  run bash "${UTILITIES_DIR}/spark-clock.sh" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"DGX Spark GPU Clock Status"* ]]
  [[ "$output" == *"Target range"* ]]
  [[ "$output" == *"Health"* ]]
}

@test "spark-clock.sh status --json includes health telemetry" {
  run bash "${UTILITIES_DIR}/spark-clock.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"health\""* ]]
  [[ "$output" == *"\"floor_mhz\": 300"* ]]
  [[ "$output" == *"\"ceiling_mhz\": 2200"* ]]
  [[ "$output" == *"\"at_target\": true"* ]]
}

@test "spark-clock.sh run is idempotent when lock configured at idle clock" {
  # Current clock is 208 MHz but configured lock is 300-2200 — must no-op
  run bash "${UTILITIES_DIR}/spark-clock.sh" run
  [ "$status" -eq 0 ]
  [[ "$output" == *"Idempotent no-op"* ]]
}

@test "spark-clock.sh run applies lock when unlocked" {
  MOCK_SPARK_CLOCK_MODE=unlocked run bash "${UTILITIES_DIR}/spark-clock.sh" run
  [ "$status" -eq 0 ]
  [[ "$output" == *"Locking graphics clocks to 300,2200"* ]]
}

@test "spark-clock.sh diagnose passes on healthy telemetry" {
  run bash "${UTILITIES_DIR}/spark-clock.sh" diagnose
  [ "$status" -eq 0 ]
  [[ "$output" == *"PASS"* ]]
}

@test "spark-clock.sh diagnose fails on pd-degraded signature" {
  MOCK_SPARK_CLOCK_MODE=pd_degraded run bash "${UTILITIES_DIR}/spark-clock.sh" diagnose
  [ "$status" -eq 1 ]
  [[ "$output" == *"Degraded samples"* ]]
}

@test "spark-clock.sh set accepts floor,ceiling range" {
  run bash "${UTILITIES_DIR}/spark-clock.sh" set 300,2100
  [ "$status" -eq 0 ]
  [[ "$output" == *"Locking graphics clocks to 300,2100"* ]]
}

@test "spark-clock.sh rejects unknown subcommand" {
  run bash "${UTILITIES_DIR}/spark-clock.sh" not-a-command
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "sync-ollama-models.sh status exits 0" {
  run bash "${UTILITIES_DIR}/sync-ollama-models.sh" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"Ollama Models Sync Status"* ]]
}

@test "sync-ollama-models.sh run exits 0 with mocked rsync" {
  run bash "${UTILITIES_DIR}/sync-ollama-models.sh" run to-remote
  [ "$status" -eq 0 ]
  [[ "$output" == *"Sync complete"* ]]
}

@test "sync-ollama-models.sh rejects unknown subcommand" {
  run bash "${UTILITIES_DIR}/sync-ollama-models.sh" invalid
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "system-update.sh status exits 0" {
  run bash "${UTILITIES_DIR}/system-update.sh" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"System Update Status"* ]]
  [[ "$output" == *"Pending apt packages"* ]]
}

@test "system-update.sh run exits 0 with mocked apt/fwupdmgr" {
  run bash "${UTILITIES_DIR}/system-update.sh" run
  [ "$status" -eq 0 ]
  [[ "$output" == *"Starting system update sequence"* ]]
}

@test "system-update.sh rejects unknown subcommand" {
  run bash "${UTILITIES_DIR}/system-update.sh" bogus
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "open-webui-stack.sh catalog exits 0 and includes stacks" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/open-webui-stack.sh" catalog --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"open-webui-lab"* ]]
  [[ "$output" == *"hermes-gateway"* ]]
}

@test "open-webui-stack.sh rejects unknown subcommand" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/open-webui-stack.sh" not-a-command
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "monitoring-stack.sh status --json includes grafana and dashboards" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/monitoring-stack.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"grafana"* ]]
  [[ "$output" == *"spark-overview"* ]]
  [[ "$output" == *"dashboards"* ]]
}

@test "monitoring-stack.sh rejects unknown subcommand" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/monitoring-stack.sh" not-a-command
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "mcp-stack.sh catalog exits 0 and includes mcp-agent-toolkit" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/mcp-stack.sh" catalog --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"mcp-agent-toolkit"* ]]
}

@test "mcp-stack.sh rejects unknown subcommand" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/mcp-stack.sh" not-a-command
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "hermes-stack.sh catalog exits 0 and includes hermes-lab" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/hermes-stack.sh" catalog --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"hermes-lab"* ]]
}

@test "hermes-stack.sh rejects unknown subcommand" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/hermes-stack.sh" not-a-command
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "sync-hermes-seed.sh copies profile into coder template seed" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/sync-hermes-seed.sh"
  [ "$status" -eq 0 ]
  [ -f "${REPO_ROOT}/k8s/dev/templates/coder-spark-lab/hermes-seed/config.yaml" ]
  cmp -s "${REPO_ROOT}/hermes/profiles/workspace-dev/config.yaml" \
    "${REPO_ROOT}/k8s/dev/templates/coder-spark-lab/hermes-seed/config.yaml"
}

@test "inference-workloads.sh status --json includes jobs and namespace" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/inference-workloads.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"jobs\""* ]]
  [[ "$output" == *"\"namespace\""* ]]
  [[ "$output" == *"ai-inference"* ]]
}

@test "nemotron-stack.sh catalog --json includes stacks" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/nemotron-stack.sh" catalog --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"stacks\""* ]]
  [[ "$output" == *"nemotron-agentic-spark-1"* ]]
}

@test "nemotron-stack.sh status --json includes stack entries" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/nemotron-stack.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"stacks\""* ]]
  [[ "$output" == *"\"namespace\""* ]]
}

@test "nemotron-stack.sh rejects unknown subcommand" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/nemotron-stack.sh" not-a-command
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "cluster-resources.sh status --json includes capacity fields" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/cluster-resources.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"allocatable\""* ]]
  [[ "$output" == *"\"node_count\""* ]]
}

@test "cluster-resources.sh check --action model:kimi-test passes with mock capacity" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/cluster-resources.sh" check --action model:kimi-test
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"ok\": true"* ]]
  [[ "$output" == *"model:kimi-test"* ]]
}

@test "cluster-resources.sh rejects unknown subcommand" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/cluster-resources.sh" bogus
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "dev-workspaces.sh status --json includes coder and kasm" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/dev-workspaces.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"coder\""* ]]
  [[ "$output" == *"\"kasm\""* ]]
}

@test "dev-workspaces.sh rejects unknown subcommand" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/dev-workspaces.sh" not-a-command
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "download-qwen-models.sh status --json includes tiers" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  export MODELS_DIR="$TEST_TMP_DIR/models"
  mkdir -p "$MODELS_DIR"
  run bash "${REPO_ROOT}/scripts/utilities/download-qwen-models.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"tiers\""* ]]
  [[ "$output" == *"122b"* ]]
}

@test "download-glm52-gguf.sh status reports shard summary" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  export MODELS_DIR="$TEST_TMP_DIR/models"
  mkdir -p "$MODELS_DIR"
  run bash "${REPO_ROOT}/scripts/utilities/download-glm52-gguf.sh" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"GLM-5.2 UD-IQ1_M GGUF Download Status"* ]]
  [[ "$output" == *"Shards found:"* ]]
}

@test "workspace-hermes.sh status --json includes workspace-dev stack" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/workspace-hermes.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"hermes-workspace-dev"* ]]
  [[ "$output" == *"\"profile_files\""* ]]
}

@test "workspace-hermes.sh rejects unknown subcommand" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/workspace-hermes.sh" not-a-command
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "kasm-workspace-image.sh info prints image metadata" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/kasm-workspace-image.sh" info
  [ "$status" -eq 0 ]
  [[ "$output" == *"spark-lab-kasm-desktop"* ]]
  [[ "$output" == *"Dockerfile"* ]]
}

@test "kasm-workspace-image.sh rejects unknown subcommand" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/kasm-workspace-image.sh" not-a-command
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "runner.sh dispatches to spark-clock status" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/runner.sh" spark-clock status
  [ "$status" -eq 0 ]
  [[ "$output" == *"DGX Spark GPU Clock Status"* ]]
}