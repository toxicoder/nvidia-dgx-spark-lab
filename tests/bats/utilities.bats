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

  # Mock nvidia-smi for spark-clock.
  #   MOCK_SPARK_CLOCK_MODE: healthy|unlocked|apps_unknown|pd_degraded
  #   MOCK_SPARK_CLOCK_LOCK_READBACK: 1 when the driver reflects -lgc in min/max clocks
  #   MOCK_SPARK_CLOCK_REJECT_COMBINED: 1 to reject multi-field --query-gpu calls
  export MOCK_SPARK_CLOCK_MODE="${MOCK_SPARK_CLOCK_MODE:-healthy}"
  export MOCK_SPARK_CLOCK_LOCK_READBACK="${MOCK_SPARK_CLOCK_LOCK_READBACK:-0}"
  export MOCK_SPARK_CLOCK_REJECT_COMBINED="${MOCK_SPARK_CLOCK_REJECT_COMBINED:-0}"
  export MOCK_SPARK_CLOCK_LOCK_FILE="$TEST_TMP_DIR/mock-gpu-lock"
  export SPARK_CLOCK_STATE_FILE="$TEST_TMP_DIR/spark-clock-lock-record"
  export SPARK_CLOCK_SERVICE_PATH="$TEST_TMP_DIR/nvidia-clock-optimize.service"
  mkdir -p "$TEST_TMP_DIR/usrlocal"
  export SPARK_CLOCK_SCRIPT_INSTALL_PATH="$TEST_TMP_DIR/usrlocal/spark-clock.sh"
  export SYSTEMCTL_CALLS_LOG="$TEST_TMP_DIR/systemctl_calls.log"
  cat > "$TEST_TMP_DIR/bin/nvidia-smi" << 'MOCKNVIDIA'
#!/usr/bin/env bash
mode="${MOCK_SPARK_CLOCK_MODE:-healthy}"
lock_readback="${MOCK_SPARK_CLOCK_LOCK_READBACK:-0}"
reject_combined="${MOCK_SPARK_CLOCK_REJECT_COMBINED:-0}"
lock_file="${MOCK_SPARK_CLOCK_LOCK_FILE:-/tmp/mock-spark-clock-lock}"
supported_max_mhz=3003

# Column order mirrors GPU_QUERY_FIELDS in scripts/utilities/spark-clock.sh.
query_fields="clocks.current.graphics,clocks.min.graphics,clocks.max.graphics,clocks.applications.graphics,temperature.gpu,temperature.gpu_tlimit_temp,power.draw,utilization.gpu,clocks_throttle_reasons.active,clocks_throttle_reasons.applications_clocks_setting,clocks_event_reasons.sw_power_capping,clocks_event_reasons.sw_thermal_slowdown,clocks_event_reasons.hw_thermal_slowdown,persistence_mode"

set_row() {
  current=208; min="[N/A]"; max="$supported_max_mhz"; apps="N/A"
  temp=45; tlimit=55; power=7.0; util=0
  reason="Not Active"; apps_reason="Not Active"; q_apps_reason="$apps_reason"
  swpc=0; swt=0; hwt=0; persist=Enabled

  if [[ -f "$lock_file" ]]; then
    # NVML has no getter for -lgc: the driver keeps reporting hardware clocks and
    # the applications-clocks throttle reason stays Not Active.
    current=208; temp=68; tlimit=42
    if [[ "$lock_readback" == "1" ]]; then
      min=$(cut -d, -f1 "$lock_file")
      max=$(cut -d, -f2 "$lock_file")
    fi
    return 0
  fi

  case "$mode" in
    unlocked|apps_unknown)
      # apps_unknown: the CSV field is unsupported while -q still prints the reason.
      [[ "$mode" == "apps_unknown" ]] && apps_reason="N/A"
      ;;
    pd_degraded)
      current=513; min=300; max=2200; apps=2418
      temp=44; tlimit=50; power=14.5; util=96
      apps_reason="Active"; swpc=1369000000
      ;;
    healthy|*)
      # Idle GPU with lock range 300-2200 already applied
      min=300; max=2200; apps=2418
      temp=68; tlimit=42
      apps_reason="Active"
      ;;
  esac
}

gpu_row() {
  set_row
  echo "$current, $min, $max, $apps, $temp, $tlimit, $power, $util, $reason, $apps_reason, $swpc, $swt, $hwt, $persist"
}

query_list=""
for arg in "$@"; do
  case "$arg" in
    --query-gpu=*) query_list="${arg#--query-gpu=}" ;;
  esac
done

if [[ -n "$query_list" ]]; then
  if [[ "$query_list" == *","* && "$reject_combined" == "1" ]]; then
    echo "Invalid property name" >&2
    exit 255
  fi
  row=$(gpu_row)
  IFS=',' read -r -a values <<<"$row"
  IFS=',' read -r -a wanted <<<"$query_list"
  IFS=',' read -r -a known <<<"$query_fields"
  out=()
  for field in "${wanted[@]}"; do
    idx=0
    matched=""
    for candidate in "${known[@]}"; do
      [[ "$candidate" == "$field" ]] && { matched="yes"; break; }
      idx=$((idx + 1))
    done
    if [[ -z "$matched" ]]; then
      echo "Invalid property name: $field" >&2
      exit 255
    fi
    value="${values[$idx]}"
    out+=("$(printf '%s' "$value" | tr -d ' ')")
  done
  (IFS=,; printf '%s\n' "${out[*]}")
  exit 0
fi

case "$*" in
  *-q*)
    set_row
    echo "Applications Clocks Setting : $q_apps_reason"
    echo "Persistence Mode : $persist"
    ;;
  *-lgc*)
    spec=""
    prev=""
    for arg in "$@"; do
      [[ "$prev" == "-lgc" ]] && spec="$arg"
      prev="$arg"
    done
    [[ "$spec" == *,* ]] || spec="300,2200"
    printf '%s\n' "$spec" >"$lock_file"
    echo "GPU clocks set to \"(gpuClkMin ${spec%%,*}, gpuClkMax ${spec##*,})\" for GPU 0000000F:01:00.0"
    echo "All done."
    ;;
  *-rgc*)
    rm -f "$lock_file"
    echo "All done."
    ;;
  *)
    exit 0
    ;;
esac
MOCKNVIDIA
  chmod +x "$TEST_TMP_DIR/bin/nvidia-smi"

  cat > "$TEST_TMP_DIR/bin/systemctl" << 'MOCKSYSTEMCTL'
#!/usr/bin/env bash
echo "systemctl $*" >>"${SYSTEMCTL_CALLS_LOG:-/dev/null}"
exit 0
MOCKSYSTEMCTL
  chmod +x "$TEST_TMP_DIR/bin/systemctl"

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
  export MOCK_SPARK_CLOCK_MODE MOCK_SPARK_CLOCK_LOCK_READBACK MOCK_SPARK_CLOCK_REJECT_COMBINED
  export MOCK_SPARK_CLOCK_LOCK_FILE SPARK_CLOCK_STATE_FILE SPARK_CLOCK_SERVICE_PATH
  export SPARK_CLOCK_SCRIPT_INSTALL_PATH SYSTEMCTL_CALLS_LOG
  rm -f "$MOCK_SPARK_CLOCK_LOCK_FILE" "$SPARK_CLOCK_STATE_FILE"
  rm -f "$SPARK_CLOCK_SCRIPT_INSTALL_PATH" "$SPARK_CLOCK_SERVICE_PATH"
  if [[ -f "${TEST_TMP_DIR}/bin/nvidia-smi.disabled" ]]; then
    mv "${TEST_TMP_DIR}/bin/nvidia-smi.disabled" "${TEST_TMP_DIR}/bin/nvidia-smi"
  fi
  : >"$SYSTEMCTL_CALLS_LOG"
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

@test "spark-clock.sh runs standalone when copied outside the repo tree" {
  # The systemd unit execs /usr/local/bin/spark-clock.sh, which has no ../lib sibling.
  local standalone_dir="$TEST_TMP_DIR/standalone"
  mkdir -p "$standalone_dir"
  cp "${UTILITIES_DIR}/spark-clock.sh" "$standalone_dir/spark-clock.sh"
  run bash "$standalone_dir/spark-clock.sh" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"DGX Spark GPU Clock Status"* ]]
  [[ "$output" != *"No such file or directory"* ]]
}

@test "spark-clock.sh --enable-systemd-service installs a runnable script and unit" {
  run bash "${UTILITIES_DIR}/spark-clock.sh" --enable-systemd-service
  [ "$status" -eq 0 ]
  [[ "$output" == *"enabled and started"* ]]
  [ -x "$SPARK_CLOCK_SCRIPT_INSTALL_PATH" ]
  [ -f "$SPARK_CLOCK_SERVICE_PATH" ]
  grep -q "ExecStart=${SPARK_CLOCK_SCRIPT_INSTALL_PATH} run" "$SPARK_CLOCK_SERVICE_PATH"
  grep -q "systemctl start nvidia-clock-optimize.service" "$SYSTEMCTL_CALLS_LOG"
  # The unit execs the installed copy with no repo ../lib available.
  run bash "$SPARK_CLOCK_SCRIPT_INSTALL_PATH" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"health\""* ]]
}

@test "spark-clock.sh --enable-systemd-service stops before systemd when the copy fails" {
  printf 'not a directory\n' >"$TEST_TMP_DIR/blocked"
  SPARK_CLOCK_SCRIPT_INSTALL_PATH="$TEST_TMP_DIR/blocked/spark-clock.sh" \
    run bash "${UTILITIES_DIR}/spark-clock.sh" --enable-systemd-service
  [ "$status" -ne 0 ]
  [[ "$output" == *"Could not install"* ]]
  [ ! -f "$SPARK_CLOCK_SERVICE_PATH" ]
  ! grep -q "systemctl start" "$SYSTEMCTL_CALLS_LOG"
}

@test "spark-clock.sh --enable-systemd-service refuses to enable when the installed copy cannot run" {
  mv "$TEST_TMP_DIR/bin/nvidia-smi" "$TEST_TMP_DIR/bin/nvidia-smi.disabled"
  run bash "${UTILITIES_DIR}/spark-clock.sh" --enable-systemd-service
  [ "$status" -ne 0 ]
  [[ "$output" == *"cannot run"* ]]
  [ -x "$SPARK_CLOCK_SCRIPT_INSTALL_PATH" ]
  [ ! -f "$SPARK_CLOCK_SERVICE_PATH" ]
  ! grep -q "systemctl start" "$SYSTEMCTL_CALLS_LOG"
}

@test "spark-clock.sh set reports the configured range when the driver cannot read back the lock" {
  # nvidia-smi has no getter for -lgc, so the readback must not claim "unlocked"
  # right after a successful lock.
  run bash "${UTILITIES_DIR}/spark-clock.sh" set 300,2200
  [ "$status" -eq 0 ]
  [[ "$output" == *"Locking graphics clocks to 300,2200"* ]]
  [[ "$output" == *"Success. Configured range: 300,2200"* ]]
  [[ "$output" != *"Configured range: unlocked"* ]]
}

@test "spark-clock.sh run no-ops on a fresh lock record when the driver cannot read back the lock" {
  MOCK_SPARK_CLOCK_MODE=unlocked run bash "${UTILITIES_DIR}/spark-clock.sh" run
  [[ "$output" == *"Locking graphics clocks"* ]]
  run bash "${UTILITIES_DIR}/spark-clock.sh" run
  [ "$status" -eq 0 ]
  [[ "$output" == *"Idempotent no-op"* ]]
}

@test "spark-clock.sh run re-applies the lock when live clocks contradict the record" {
  printf '300,2200\n' >"$SPARK_CLOCK_STATE_FILE"
  printf '300,2100\n' >"$MOCK_SPARK_CLOCK_LOCK_FILE"
  MOCK_SPARK_CLOCK_LOCK_READBACK=1 run bash "${UTILITIES_DIR}/spark-clock.sh" run
  [ "$status" -eq 0 ]
  [[ "$output" == *"Locking graphics clocks to 300,2200"* ]]
}

@test "spark-clock.sh reset clears the lock record" {
  run bash "${UTILITIES_DIR}/spark-clock.sh" set 300,2200
  [ -f "$SPARK_CLOCK_STATE_FILE" ]
  run bash "${UTILITIES_DIR}/spark-clock.sh" reset
  [ "$status" -eq 0 ]
  [ ! -f "$SPARK_CLOCK_STATE_FILE" ]
  [ ! -f "$MOCK_SPARK_CLOCK_LOCK_FILE" ]
  MOCK_SPARK_CLOCK_MODE=unlocked run bash "${UTILITIES_DIR}/spark-clock.sh" status
  [[ "$output" == *"Configured range       : unlocked"* ]]
}

@test "spark-clock.sh status keeps telemetry when the driver rejects the combined query" {
  MOCK_SPARK_CLOCK_REJECT_COMBINED=1 run bash "${UTILITIES_DIR}/spark-clock.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"temperature_c\": 68"* ]]
  [[ "$output" == *"\"power_w\": 7.0"* ]]
  [[ "$output" == *"\"configured_ceiling_mhz\": \"2200\""* ]]
}

@test "spark-clock.sh status reports unlocked when apps clocks state is unknown" {
  # The -q fallback must not read "Applications Clocks Setting : Not Active" as a lock.
  MOCK_SPARK_CLOCK_MODE=apps_unknown run bash "${UTILITIES_DIR}/spark-clock.sh" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"Configured range       : unlocked"* ]]
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

@test "download-qwen-models.sh status --tier 27b-38-nvfp4 is Unsloth Qwen3.8-27B NVFP4" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  export MODELS_DIR="$TEST_TMP_DIR/models"
  mkdir -p "$MODELS_DIR"
  run bash "${REPO_ROOT}/scripts/utilities/download-qwen-models.sh" status --tier 27b-38-nvfp4 --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"27b-38-nvfp4"* ]]
  [[ "$output" == *"unsloth/Qwen3.8-27B-NVFP4"* ]]
}

@test "download-rounded-models.sh status --json includes flash-next and medgemma" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  export MODELS_DIR="$TEST_TMP_DIR/models"
  mkdir -p "$MODELS_DIR"
  run bash "${REPO_ROOT}/scripts/utilities/download-rounded-models.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"tiers\""* ]]
  [[ "$output" == *"flash-next"* ]]
  [[ "$output" == *"medgemma"* ]]
}

@test "download-dsv41-flash.sh status --json uses official DeepSeek-V4.1-Flash" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  export MODELS_DIR="$TEST_TMP_DIR/models"
  mkdir -p "$MODELS_DIR"
  run bash "${REPO_ROOT}/scripts/utilities/download-dsv41-flash.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"deepseek-ai/DeepSeek-V4.1-Flash"* ]]
  [[ "$output" != *"LibertAIDAI"* ]]
  [[ "$output" != *"nvidia/DeepSeek-V4-Flash-NVFP4"* ]]
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

# ## download-<model> utilities: shared status/run contract
#
# Each download-<model>.sh utility must report the Hugging Face repo id and the
# MODELS_DIR/<org>__<Model> snapshot path from local state only (no HF call), and
# must exit non-zero with usage guidance on a subcommand it does not know.

# @function _download_hf_mock_bin
# Install huggingface-cli/hf mocks that only record argv, so a status path that
# reaches for the network trips the offline assertion in the helpers below.
# @param $1  Bin directory to create.
# @param $2  Path of the file the mocks append their invocations to.
_download_hf_mock_bin() {
  local bin="$1" log="$2" tool
  mkdir -p "$bin"
  for tool in huggingface-cli hf; do
    printf '#!/usr/bin/env bash\necho "%s $*" >>"%s"\n' "$tool" "$log" >"$bin/$tool"
    chmod +x "$bin/$tool"
  done
}

# @function _download_models_dir
# Point MODELS_DIR at a per-test scratch dir the utilities may create and inspect.
_download_models_dir() {
  export MODELS_DIR="${TEST_TMP_DIR}/models-${BATS_TEST_NUMBER}"
  mkdir -p "$MODELS_DIR"
}

# Table: utility | HF repo id | snapshot dir relative to MODELS_DIR
_DOWNLOAD_CONTRACT_CASES=(
  "download-dsv4-flash-dspark.sh|deepseek-ai/DeepSeek-V4-Flash-Vision-Exp|deepseek-ai__DeepSeek-V4-Flash-Vision-Exp"
  "download-glm53-flash-exl3.sh|Mia-AiLab/GLM-5.3-Flash-EXL3-4bpw-TensorFold|Mia-AiLab__GLM-5.3-Flash-EXL3-4bpw-TensorFold"
  "download-qwen38-27b-exl3.sh|turboderp/Qwen3.8-27B-exl3|turboderp__Qwen3.8-27B-exl3/3.0bpw"
  "download-qwen38-27b-tensorfold.sh|Vontra/Qwen3.8-27B-MLX-4bit|Vontra__Qwen3.8-27B-MLX-4bit"
  "download-qwen38-flash-next-tensorfold.sh|nvidia/Qwen3.8-Flash-Next-FP4-Local|nvidia__Qwen3.8-Flash-Next-FP4-Local"
  "download-nemotron-transcribe.sh|nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-NVFP4|nvidia__NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-NVFP4"
)

@test "download model utilities report status --json offline" {
  local entry script repo flat bin
  for entry in "${_DOWNLOAD_CONTRACT_CASES[@]}"; do
    IFS='|' read -r script repo flat <<<"$entry"
    _download_models_dir
    bin="${TEST_TMP_DIR}/hf-status-${BATS_TEST_NUMBER}-${script%.sh}"
    _download_hf_mock_bin "$bin" "${bin}/calls.log"
    run env -u HF_TOKEN PATH="${bin}:${PATH}" \
      bash "${REPO_ROOT}/scripts/utilities/${script}" status --json
    [ "$status" -eq 0 ]
    [[ "$output" == *"\"repo\":\"${repo}\""* ]]
    [[ "$output" == *"\"path\":\"${MODELS_DIR}/${flat}\""* ]]
    [[ "$output" == *"\"ready\":"* ]]
    [ ! -s "${bin}/calls.log" ]
  done
}

@test "download model utilities report the repo id in plain status" {
  local entry script repo
  for entry in "${_DOWNLOAD_CONTRACT_CASES[@]}"; do
    IFS='|' read -r script repo _ <<<"$entry"
    _download_models_dir
    run env -u HF_TOKEN bash "${REPO_ROOT}/scripts/utilities/${script}" status
    [ "$status" -eq 0 ]
    [[ "$output" == *"${repo}"* ]]
  done
}

@test "download model utilities reject an unknown subcommand" {
  local entry script
  for entry in "${_DOWNLOAD_CONTRACT_CASES[@]}"; do
    IFS='|' read -r script _ _ <<<"$entry"
    _download_models_dir
    run bash "${REPO_ROOT}/scripts/utilities/${script}" not-a-command
    [ "$status" -eq 1 ]
    [[ "$output" == *"Usage:"* || "$output" == *"Unknown arg"* ]]
  done
}

@test "download model utilities run through the HF CLI only" {
  local entry script repo flat bin
  for entry in "${_DOWNLOAD_CONTRACT_CASES[@]}"; do
    IFS='|' read -r script repo flat <<<"$entry"
    _download_models_dir
    bin="${TEST_TMP_DIR}/hf-run-${BATS_TEST_NUMBER}-${script%.sh}"
    _download_hf_mock_bin "$bin" "${bin}/calls.log"
    run env -u HF_TOKEN -u ABLIT_REPO PATH="${bin}:${PATH}" \
      bash "${REPO_ROOT}/scripts/utilities/${script}" run
    [ "$status" -eq 0 ]
    grep -q -e "${repo}" "${bin}/calls.log"
    grep -q -e "--local-dir ${MODELS_DIR}/${flat}" "${bin}/calls.log"
  done
}

@test "download-dsv4-flash-dspark.sh status --json reports gated ablit and token state" {
  _download_models_dir
  run env -u HF_TOKEN bash "${REPO_ROOT}/scripts/utilities/download-dsv4-flash-dspark.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"drowzeys/keys-DeepSeekV4Flash-Vision-EXP-ablit"* ]]
  [[ "$output" == *"\"ablit_ready\":false"* ]]
  [[ "$output" == *"\"hf_token\":false"* ]]
}

@test "download-dsv4-flash-dspark.sh status tells the operator to seed both Sparks" {
  _download_models_dir
  run bash "${REPO_ROOT}/scripts/utilities/download-dsv4-flash-dspark.sh" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"Run on BOTH Sparks"* ]]
  [[ "$output" == *"start-dsv4-flash-dspark"* ]]
}

@test "download-glm53-flash-exl3.sh status --json reports drafter and gated ablit" {
  _download_models_dir
  run env -u HF_TOKEN bash "${REPO_ROOT}/scripts/utilities/download-glm53-flash-exl3.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"drafter_repo\":\"incoai/GLM-5.3-Flash-DFlash2\""* ]]
  [[ "$output" == *"incoai__GLM-5.3-Flash-DFlash2"* ]]
  [[ "$output" == *"\"drafter_ready\":false"* ]]
  [[ "$output" == *"\"ablit_repo\":\"Mia-AiLab/GLM-5.3-Flash-EXL3-4bpw-TensorFold-Ablit\""* ]]
  [[ "$output" == *"\"ablit_path\":\""*"Mia-AiLab__GLM-5.3-Flash-EXL3-4bpw-TensorFold-Ablit\""* ]]
  [[ "$output" == *"\"hf_token\":false"* ]]
}

@test "download-glm53-flash-exl3.sh status flags the non-commercial drafter license" {
  _download_models_dir
  run bash "${REPO_ROOT}/scripts/utilities/download-glm53-flash-exl3.sh" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"CC BY-NC-ND 4.0"* ]]
  [[ "$output" == *"DRAFTER=mtp"* ]]
  [[ "$output" == *"at ${MODELS_DIR}/Mia-AiLab__GLM-5.3-Flash-EXL3-4bpw-TensorFold-Ablit"* ]]
}

@test "download-qwen38-27b-exl3.sh default tier pins the turboderp 3.0bpw revision" {
  _download_models_dir
  run bash "${REPO_ROOT}/scripts/utilities/download-qwen38-27b-exl3.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"tier\":\"3.0bpw\""* ]]
  [[ "$output" == *"\"revision\":\"3.0bpw\""* ]]
  [[ "$output" == *"\"path\":\"${MODELS_DIR}/turboderp__Qwen3.8-27B-exl3/3.0bpw\""* ]]
  [[ "$output" == *"r0b0tlab__Qwen3.8-27B-DFlash2-EXL3-4.00bpw"* ]]
}

@test "download-qwen38-27b-exl3.sh --tier 2.0bpw switches repo and drops the revision" {
  _download_models_dir
  run bash "${REPO_ROOT}/scripts/utilities/download-qwen38-27b-exl3.sh" status --tier 2.0bpw --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"Mia-AiLab/Qwen3.8-27B-EXL3-2.0bpw"* ]]
  [[ "$output" == *"\"revision\":\"\","* ]]
  [[ "$output" == *"Mia-AiLab__Qwen3.8-27B-EXL3-2.0bpw/2.0bpw"* ]]
}

@test "download-qwen38-27b-exl3.sh rejects an unknown tier" {
  _download_models_dir
  run bash "${REPO_ROOT}/scripts/utilities/download-qwen38-27b-exl3.sh" status --tier 9.9bpw
  [ "$status" -eq 1 ]
  [[ "$output" == *"Unknown tier: 9.9bpw"* ]]
  [[ "$output" == *"6.0bpw"* ]]
}

@test "download-qwen38-27b-exl3.sh rejects --tier with no value" {
  _download_models_dir
  run bash "${REPO_ROOT}/scripts/utilities/download-qwen38-27b-exl3.sh" run --tier
  [ "$status" -ne 0 ]
  [[ "$output" == *"--tier needs a value"* ]]
}

@test "download-qwen38-27b-tensorfold.sh status --json reports the served model and drafter" {
  _download_models_dir
  run bash "${REPO_ROOT}/scripts/utilities/download-qwen38-27b-tensorfold.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"drafter_repo\":\"z-lab/Qwen3.8-27B-DFlash2\""* ]]
  [[ "$output" == *"\"drafter_path\":\"${MODELS_DIR}/z-lab__Qwen3.8-27B-DFlash2\""* ]]
  [[ "$output" == *"\"drafter_ready\":false"* ]]
}

@test "download-qwen38-flash-next-tensorfold.sh status --json pins the nvidia revision" {
  _download_models_dir
  run env -u ABLIT_REPO -u HF_TOKEN \
    bash "${REPO_ROOT}/scripts/utilities/download-qwen38-flash-next-tensorfold.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"revision\":\"b9ce18a6887e18c089fdea8509a33e63429a3300\""* ]]
  [[ "$output" == *"drowzeys/keys-house-qsa-ablit"* ]]
  [[ "$output" == *"\"hf_token\":false"* ]]
}

@test "download-qwen38-flash-next-tensorfold.sh status says MTP drafts ship in-checkpoint" {
  _download_models_dir
  run bash "${REPO_ROOT}/scripts/utilities/download-qwen38-flash-next-tensorfold.sh" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"no drafter repo to download"* ]]
  [[ "$output" == *"qwen3.8-flash-next-tensorfold"* ]]
}

@test "download-nemotron-transcribe.sh status ties the path to the NVFP4 Blackwell lane" {
  _download_models_dir
  run bash "${REPO_ROOT}/scripts/utilities/download-nemotron-transcribe.sh" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"NVFP4 requires Blackwell"* ]]
  [[ "$output" == *"MODEL_NAME=/models/nvidia__NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-NVFP4"* ]]
  [[ "$output" == *"${MODELS_DIR}"* ]]
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

@test "disk-wizard.sh status --json includes pressure and apply false" {
  export LAB_HERMETIC=1
  export MODELS_DIR="${TEST_TMP_DIR}/models"
  export DISK_WIZARD_HOME="${TEST_TMP_DIR}/home"
  mkdir -p "$MODELS_DIR" "$DISK_WIZARD_HOME"
  export LAB_MOCK_DF_JSON='{"size_bytes":1000,"used_bytes":100,"avail_bytes":900,"used_pct":10}'
  run bash "${UTILITIES_DIR}/disk-wizard.sh" status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"pressure\""* ]]
  [[ "$output" == *"\"apply\": false"* ]]
}

@test "disk-wizard.sh run is read-only" {
  export LAB_HERMETIC=1
  export MODELS_DIR="${TEST_TMP_DIR}/models"
  export DISK_WIZARD_HOME="${TEST_TMP_DIR}/home"
  mkdir -p "$MODELS_DIR" "$DISK_WIZARD_HOME"
  printf 'x' >"${MODELS_DIR}/stay.incomplete"
  export LAB_MOCK_DF_JSON='{"size_bytes":1000,"used_bytes":100,"avail_bytes":900,"used_pct":10}'
  run bash "${UTILITIES_DIR}/disk-wizard.sh" run
  [ "$status" -eq 0 ]
  [[ -f ${MODELS_DIR}/stay.incomplete ]]
  [[ ! -d ${MODELS_DIR}/.disk-quarantine ]]
}

@test "runner.sh dispatches to spark-clock status" {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  run bash "${REPO_ROOT}/scripts/utilities/runner.sh" spark-clock status
  [ "$status" -eq 0 ]
  [[ "$output" == *"DGX Spark GPU Clock Status"* ]]
}

# @function _mock_tool
# Write a mock executable named $2 that echoes $3; $1 = bin dir.
_mock_tool() {
  printf '#!/usr/bin/env bash\necho "%s"\n' "$3" > "$1/$2"
  chmod +x "$1/$2"
}

# @function _operator_client_mocks
# Put a full operator toolchain (git/ssh/python3/ansible/kubectl/helm/bazelisk/jq)
# on PATH in a fresh mock bin dir; $1 = bin dir.
_operator_client_mocks() {
  local bin="$1"
  _mock_tool "$bin" git "git version 2.44.0"
  _mock_tool "$bin" ssh "OpenSSH_9.6"
  _mock_tool "$bin" python3 "Python 3.12.3"
  _mock_tool "$bin" ansible "ansible [core 2.17.1]"
  _mock_tool "$bin" kubectl "v1.31.0"
  _mock_tool "$bin" helm "v3.15.2+g071fa8f"
  _mock_tool "$bin" bazelisk "bazelisk 1.19.0"
  _mock_tool "$bin" jq "jq-1.7"
}

@test "install-operator-client.sh status exits 0 and reports ready with a full toolchain" {
  local bin
  bin="$(mktemp -d)/bin"
  mkdir -p "$bin"
  _operator_client_mocks "$bin"
  run env PATH="$bin:$PATH" LAB_OPERATOR_CLIENT_OS=Linux \
    bash "${REPO_ROOT}/scripts/utilities/install-operator-client.sh" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"Operator Client Status"* ]]
  [[ "$output" == *"OK  ansible"* ]]
  [[ "$output" == *"Operator client is ready"* ]]
}

@test "install-operator-client.sh status flags missing tools" {
  # PATH with only the bare basics (bash, uname) and none of the operator
  # tools — status must still work on a machine before anything is installed.
  local stripped
  stripped="$(mktemp -d)"
  ln -s "$(command -v bash)" "$stripped/bash"
  ln -s "$(command -v uname)" "$stripped/uname"
  run env PATH="$stripped" LAB_OPERATOR_CLIENT_OS=Linux \
    bash "${REPO_ROOT}/scripts/utilities/install-operator-client.sh" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"--  ansible"* ]]
  [[ "$output" == *"missing"* ]]
}

@test "install-operator-client.sh status flags an old ansible version" {
  local bin
  bin="$(mktemp -d)/bin"
  mkdir -p "$bin"
  _operator_client_mocks "$bin"
  _mock_tool "$bin" ansible "ansible [core 2.9.1]"
  run env PATH="$bin:$PATH" LAB_OPERATOR_CLIENT_OS=Linux \
    bash "${REPO_ROOT}/scripts/utilities/install-operator-client.sh" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"older than 2.14"* ]]
  [[ "$output" == *"missing"* ]]
}

@test "install-operator-client.sh run is a verified no-op when all tools are present" {
  local bin
  bin="$(mktemp -d)/bin"
  mkdir -p "$bin"
  _operator_client_mocks "$bin"
  # Mock the package manager path too: CI runners ship real sudo/apt-get, and
  # the unmocked host tools would otherwise satisfy the `command -v` gate and
  # let the script run a live `sudo apt-get update`.
  _mock_tool "$bin" sudo "sudo (mock)"
  _mock_tool "$bin" apt-get "apt-get (mock)"
  run env PATH="$bin:$PATH" LAB_OPERATOR_CLIENT_OS=Linux \
    bash "${REPO_ROOT}/scripts/utilities/install-operator-client.sh" run
  [ "$status" -eq 0 ]
  [[ "$output" == *"Operator client install (Linux)"* ]]
  [[ "$output" == *"Operator client is ready"* ]]
  [[ "$output" == *"manage -- setup"* ]]
}

@test "install-operator-client.sh run attempts to install stale ansible (Linux)" {
  # Regression: the version gate must run as a command, not a constant word
  # inside [[ ]] (SC2078) — a stale ansible must trigger an install attempt.
  # (Stale mock, not absent: the host's real ansible would otherwise satisfy
  # the check through the unstripped PATH tail.)
  local bin
  bin="$(mktemp -d)/bin"
  mkdir -p "$bin"
  _operator_client_mocks "$bin"
  _mock_tool "$bin" ansible "ansible [core 2.9.1]"
  _mock_tool "$bin" sudo "sudo (mock)"
  _mock_tool "$bin" apt-get "apt-get (mock)"
  run env PATH="$bin:$PATH" LAB_OPERATOR_CLIENT_OS=Linux \
    bash "${REPO_ROOT}/scripts/utilities/install-operator-client.sh" run
  [ "$status" -eq 1 ]
  [[ "$output" == *"→ install ansible"* ]]
  [[ "$output" == *"Operator client not ready"* ]]
}

@test "install-operator-client.sh run on Windows points at the WSL2 bootstrap" {
  run env LAB_OPERATOR_CLIENT_OS=Windows \
    bash "${REPO_ROOT}/scripts/utilities/install-operator-client.sh" run
  [ "$status" -ne 0 ]
  [[ "$output" == *"install-operator-client.ps1"* ]]
}

@test "install-operator-client.sh rejects unknown subcommand" {
  run bash "${REPO_ROOT}/scripts/utilities/install-operator-client.sh" bogus
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}