#!/usr/bin/env bash
#
# ## spark-clock
#
# Manage GPU graphics clocks on DGX Spark (Blackwell GB10) for thermal stability.
#
# **Intent**: GB10 has no user-controllable power limit or fan curve on DGX Spark
# (`nvidia-smi -pl` and fan speed return N/A). The only operator-accessible actuator
# is graphics clock locking via `nvidia-smi -lgc`. Range lock (default 300–2200 MHz)
# caps peak clocks to avoid sustained 78–88°C temps and thermal shutdowns during
# long-running inference, with near-zero impact on memory-bound MoE workloads.
#
# **Idempotency** (core of the utility pattern):
# - `status` reports configured lock range, telemetry, and health classification.
# - `run` is a no-op when the configured lock range already matches targets.
# - Service install is idempotent (only rewrites unit if content differs).
#
# **Safety**:
# - Never touches ai-inference namespace workloads.
# - Requires nvidia-smi; mutation verbs require root (or passwordless sudo).
# - Respects the lab's GPU Operator + nvidia-persistenced.
# - Detects PD-degraded states (513–650 MHz / ~15W) and advises power-cycle.
#
# Usage (CLI):
#   ./scripts/utilities/spark-clock.sh status [--json]
#   ./scripts/utilities/spark-clock.sh run                 # idempotent optimize to target
#   ./scripts/utilities/spark-clock.sh reset
#   ./scripts/utilities/spark-clock.sh set 2100            # ceiling only
#   ./scripts/utilities/spark-clock.sh set 300,2100        # floor,ceiling range
#   ./scripts/utilities/spark-clock.sh diagnose
#   ./scripts/utilities/spark-clock.sh --enable-systemd-service
#   ./scripts/utilities/spark-clock.sh --disable-systemd-service
#
# Env overrides: CLOCK_FLOOR_MHZ, CLOCK_CEILING_MHZ (TARGET_CLOCK_MHZ aliases ceiling),
# THERMAL_WARN_C, THERMAL_HOT_C, PD_* thresholds.
#
# Dashboard integration: The UI will call status --json and run/reset subcommands.
#
# @command spark-clock
# @command clock-optimize

set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
SCRIPT_DIR="$(lab_script_dir 1 utilities)"

if [[ -f "${SCRIPT_DIR}/../lib/common.sh" ]]; then
    # shellcheck source=../lib/common.sh
    source "${SCRIPT_DIR}/../lib/common.sh"
fi

# @function log
# Informational message prefixed with [spark-clock].

log()  { echo -e "[spark-clock] $*"; }
# @function warn
# Warning message to stderr.

warn() { echo -e "[spark-clock][WARN] $*" >&2; }
# @function err
# Error message to stderr.

err()  { echo -e "[spark-clock][ERROR] $*" >&2; }

# @function check_tool
# Fail if required command is not in PATH.
# @param $1  Command name.

check_tool() {
    if ! command -v "$1" >/dev/null 2>&1; then
        err "Required tool not found: $1"
        exit 1
    fi
}

# Config (overridable via env)
CLOCK_FLOOR_MHZ=${CLOCK_FLOOR_MHZ:-300}
CLOCK_CEILING_MHZ=${CLOCK_CEILING_MHZ:-${TARGET_CLOCK_MHZ:-2200}}
TARGET_CLOCK_MHZ=${TARGET_CLOCK_MHZ:-$CLOCK_CEILING_MHZ}
THERMAL_WARN_C=${THERMAL_WARN_C:-78}
THERMAL_HOT_C=${THERMAL_HOT_C:-83}
THERMAL_OK_C=${THERMAL_OK_C:-72}
PD_CLOCK_THRESHOLD_MHZ=${PD_CLOCK_THRESHOLD_MHZ:-850}
PD_POWER_THRESHOLD_W=${PD_POWER_THRESHOLD_W:-20}
PD_UTIL_THRESHOLD_PCT=${PD_UTIL_THRESHOLD_PCT:-30}
DIAGNOSE_SAMPLES=${DIAGNOSE_SAMPLES:-10}
DIAGNOSE_INTERVAL_S=${DIAGNOSE_INTERVAL_S:-0.5}
CLOCK_TOLERANCE_MHZ=${CLOCK_TOLERANCE_MHZ:-10}

SERVICE_NAME="nvidia-clock-optimize.service"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}"
SCRIPT_INSTALL_PATH="/usr/local/bin/spark-clock.sh"

GPU_QUERY_FIELDS="clocks.current.graphics,clocks.min.graphics,clocks.max.graphics,clocks.applications.graphics,temperature.gpu,temperature.gpu_tlimit_temp,power.draw,utilization.gpu,clocks_throttle_reasons.active,clocks_throttle_reasons.applications_clocks_setting,clocks_event_reasons.sw_power_capping,clocks_event_reasons.sw_thermal_slowdown,clocks_event_reasons.hw_thermal_slowdown,persistence_mode"

# --- Low-level GPU helpers ---

# @function nvidia_query
# Query GPU telemetry fields via nvidia-smi CSV output.

nvidia_query() {
    nvidia-smi --query-gpu="${GPU_QUERY_FIELDS}" --format=csv,noheader,nounits 2>/dev/null | head -1
}

# @function nvidia_smi_exec
# Run nvidia-smi with root/sudo fallback when needed.

nvidia_smi_exec() {
    if nvidia-smi "$@" 2>/dev/null; then
        return 0
    fi
    if command -v sudo >/dev/null 2>&1 && sudo -n nvidia-smi "$@" 2>/dev/null; then
        return 0
    fi
    if [[ "$(id -u)" -eq 0 ]]; then
        nvidia-smi "$@"
        return $?
    fi
    err "nvidia-smi requires root for this operation. Run with sudo."
    return 1
}

# @function require_root
# Exit unless running as root or passwordless sudo.
# @param $*  Context for error message.

require_root() {
    if [[ "$(id -u)" -eq 0 ]]; then
        return 0
    fi
    if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
        return 0
    fi
    err "Root privileges required. Run: sudo $0 $*"
    exit 1
}

# @function parse_gpu_row
# Parse nvidia_query CSV row into global telemetry variables.
# @param $1  CSV row string.

parse_gpu_row() {
    local row="${1:-}"
    IFS=',' read -r \
        CURRENT_MHZ MIN_MHZ MAX_MHZ APPS_MHZ \
        TEMP_C TLIMIT_C POWER_W UTIL_PCT \
        THROTTLE_ACTIVE APPS_CLOCK_SETTING \
        SW_POWER_CAP_US SW_THERMAL_US HW_THERMAL_US \
        PERSISTENCE <<< "$row"

    CURRENT_MHZ=$(echo "$CURRENT_MHZ" | tr -d ' ')
    MIN_MHZ=$(echo "$MIN_MHZ" | tr -d ' ')
    MAX_MHZ=$(echo "$MAX_MHZ" | tr -d ' ')
    APPS_MHZ=$(echo "$APPS_MHZ" | tr -d ' ')
    TEMP_C=$(echo "$TEMP_C" | tr -d ' ')
    TLIMIT_C=$(echo "$TLIMIT_C" | tr -d ' ')
    POWER_W=$(echo "$POWER_W" | tr -d ' ')
    UTIL_PCT=$(echo "$UTIL_PCT" | tr -d ' ')
    THROTTLE_ACTIVE=$(echo "$THROTTLE_ACTIVE" | xargs)
    APPS_CLOCK_SETTING=$(echo "$APPS_CLOCK_SETTING" | xargs)
    SW_POWER_CAP_US=$(echo "$SW_POWER_CAP_US" | tr -d ' ')
    SW_THERMAL_US=$(echo "$SW_THERMAL_US" | tr -d ' ')
    HW_THERMAL_US=$(echo "$HW_THERMAL_US" | tr -d ' ')
    PERSISTENCE=$(echo "$PERSISTENCE" | xargs)
}

# @function is_numeric
# Return true when argument is a numeric string.
# @param $1  Value to test.

is_numeric() {
    [[ "${1:-}" =~ ^[0-9]+(\.[0-9]+)?$ ]]
}

# @function clock_within_tolerance
# True when actual MHz is within tolerance of expected.
# @param $1  Actual MHz.
# @param $2  Expected MHz.
# @param $3  Tolerance MHz (optional).

clock_within_tolerance() {
    local actual="${1:-}" expected="${2:-}" tol="${3:-$CLOCK_TOLERANCE_MHZ}"
    if ! is_numeric "$actual" || ! is_numeric "$expected"; then
        return 1
    fi
    local diff
    diff=$(awk -v a="$actual" -v e="$expected" 'BEGIN { d=a-e; print (d<0)?-d:d }')
    awk -v d="$diff" -v t="$tol" 'BEGIN { exit (d<=t)?0:1 }'
}

# @function is_lock_active
# Detect whether nvidia graphics clock lock is active.
# @param $1  Applications clocks setting string.

is_lock_active() {
    local apps_setting="${1:-}"
    if [[ "$apps_setting" == "Active" ]]; then
        return 0
    fi
    if [[ "$apps_setting" == "Not Active" ]]; then
        return 1
    fi
    if nvidia-smi -q -d CLOCK 2>/dev/null | grep -qiE 'Applications Clocks Setting.*Active|Graphics.*Locked'; then
        return 0
    fi
    return 1
}

# @function get_configured_lock_range
# Return configured lock range as floor,ceiling or unlocked/locked,unknown.

get_configured_lock_range() {
    local row floor ceiling
    row=$(nvidia_query)
    parse_gpu_row "$row"

    if ! is_lock_active "$APPS_CLOCK_SETTING"; then
        echo "unlocked"
        return 0
    fi

    floor="$MIN_MHZ"
    ceiling="$MAX_MHZ"

    if ! is_numeric "$floor" || ! is_numeric "$ceiling"; then
        local parsed
        parsed=$(nvidia-smi -q -d CLOCK 2>/dev/null | awk '
            /Graphics/ && /MHz/ {
                if (match($0, /([0-9]+) MHz/, m)) print m[1]
            }' | head -2 | tr '\n' ',' | sed 's/,$//')
        if [[ "$parsed" == *,* ]]; then
            floor="${parsed%%,*}"
            ceiling="${parsed##*,}"
        elif is_numeric "$parsed"; then
            floor="$CLOCK_FLOOR_MHZ"
            ceiling="$parsed"
        fi
    fi

    if is_numeric "$floor" && is_numeric "$ceiling"; then
        echo "${floor},${ceiling}"
    else
        echo "locked,unknown"
    fi
}

# @function is_lock_at_target
# True when active lock matches CLOCK_FLOOR_MHZ and CLOCK_CEILING_MHZ.

is_lock_at_target() {
    local range floor ceiling
    range=$(get_configured_lock_range)
    if [[ "$range" == "unlocked" || "$range" == locked,* ]]; then
        return 1
    fi
    floor="${range%%,*}"
    ceiling="${range##*,}"
    clock_within_tolerance "$floor" "$CLOCK_FLOOR_MHZ" && clock_within_tolerance "$ceiling" "$CLOCK_CEILING_MHZ"
}

# @function get_supported_max_clock
# Query supported max graphics clock MHz from nvidia-smi.

get_supported_max_clock() {
    nvidia-smi --query-gpu=clocks.max.graphics --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -d ' ' || echo "unknown"
}

# @function get_service_state
# Return systemd service state for nvidia-clock-optimize.service.

get_service_state() {
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo "ACTIVE"
    elif systemctl list-unit-files 2>/dev/null | grep -q "$SERVICE_NAME"; then
        echo "INACTIVE"
    else
        echo "NOT INSTALLED"
    fi
}

# @function throttle_is_thermal
# True when throttle reason indicates thermal slowdown.
# @param $1  Throttle active string.

throttle_is_thermal() {
    local active="${1:-}"
    [[ "$active" == *"Thermal"* || "$active" == *"thermal"* || "$active" == *"HW Slowdown"* ]]
}

# @function classify_health
# Classify GPU health: ok, thermal_warn, pd_degraded, etc.
# @param $1-$6  Telemetry and at_target flag.

classify_health() {
    local temp_c="${1:-}" util_pct="${2:-}" power_w="${3:-}" current_mhz="${4:-}" throttle_active="${5:-}" at_target="${6:-false}"

    if is_numeric "$util_pct" && is_numeric "$power_w" && is_numeric "$current_mhz"; then
        if awk -v u="$util_pct" -v p="$power_w" -v c="$current_mhz" -v pu="$PD_UTIL_THRESHOLD_PCT" -v pp="$PD_POWER_THRESHOLD_W" -v pc="$PD_CLOCK_THRESHOLD_MHZ" \
            'BEGIN { exit (u>=pu && p<pp && c<pc) ? 0 : 1 }'; then
            if ! throttle_is_thermal "$throttle_active"; then
                echo "pd_degraded"
                return 0
            fi
        fi
    fi

    if [[ "$throttle_active" != "None" && "$throttle_active" != "N/A" && -n "$throttle_active" ]]; then
        if throttle_is_thermal "$throttle_active"; then
            echo "thermal_throttling"
            return 0
        fi
    fi

    if is_numeric "$temp_c"; then
        if awk -v t="$temp_c" -v h="$THERMAL_HOT_C" 'BEGIN { exit (t>=h) ? 0 : 1 }'; then
            echo "thermal_warn"
            return 0
        fi
        if awk -v t="$temp_c" -v w="$THERMAL_WARN_C" 'BEGIN { exit (t>=w) ? 0 : 1 }'; then
            echo "thermal_warn"
            return 0
        fi
    fi

    if [[ "$at_target" == "false" ]]; then
        echo "misconfigured"
        return 0
    fi

    echo "ok"
}

# @function build_recommendations
# Human-readable remediation for a health classification.
# @param $1  Health status string.

build_recommendations() {
    local health="${1:-ok}"
    case "$health" in
        pd_degraded)
            echo "Disconnect power brick from wall and Spark, wait 60s, reconnect. Clock lock cannot fix PD negotiation failures."
            ;;
        thermal_throttling)
            echo "GPU is actively thermal-throttling. Verify clock lock is applied (run) and ambient cooling is adequate."
            ;;
        thermal_warn)
            echo "Temperature in warning band (>= ${THERMAL_WARN_C}C). Consider lowering CLOCK_CEILING_MHZ or improving airflow."
            ;;
        misconfigured)
            echo "Clock lock not at target range (${CLOCK_FLOOR_MHZ},${CLOCK_CEILING_MHZ} MHz). Run: sudo $0 run"
            ;;
    esac
}

# @function collect_status_data
# Populate global status variables from live GPU telemetry.

collect_status_data() {
    local row range at_target health
    row=$(nvidia_query)
    parse_gpu_row "$row"

    range=$(get_configured_lock_range)
    if [[ "$range" == "unlocked" ]]; then
        LOCKED="false"
        CONFIG_FLOOR=""
        CONFIG_CEILING=""
    elif [[ "$range" == locked,* ]]; then
        LOCKED="true"
        CONFIG_FLOOR="unknown"
        CONFIG_CEILING="unknown"
    else
        LOCKED="true"
        CONFIG_FLOOR="${range%%,*}"
        CONFIG_CEILING="${range##*,}"
    fi

    if is_lock_at_target; then
        at_target="true"
    else
        at_target="false"
    fi

    health=$(classify_health "$TEMP_C" "$UTIL_PCT" "$POWER_W" "$CURRENT_MHZ" "$THROTTLE_ACTIVE" "$at_target")
    HEALTH="$health"
    AT_TARGET="$at_target"
    SERVICE_STATE=$(get_service_state)
    SUPPORTED_MAX=$(get_supported_max_clock)

    if ! is_numeric "$CURRENT_MHZ"; then CURRENT_MHZ=0; fi
    if ! is_numeric "$TEMP_C"; then TEMP_C="null"; else TEMP_C="$TEMP_C"; fi
    if ! is_numeric "$TLIMIT_C"; then TLIMIT_C="null"; else TLIMIT_C="$TLIMIT_C"; fi
    if ! is_numeric "$POWER_W"; then POWER_W="null"; else POWER_W="$POWER_W"; fi
    if ! is_numeric "$UTIL_PCT"; then UTIL_PCT="null"; else UTIL_PCT="$UTIL_PCT"; fi
    if ! is_numeric "$APPS_MHZ"; then APPS_MHZ="null"; else APPS_MHZ="$APPS_MHZ"; fi
    if ! is_numeric "$SW_POWER_CAP_US"; then SW_POWER_CAP_US=0; fi
    if ! is_numeric "$SW_THERMAL_US"; then SW_THERMAL_US=0; fi
    if ! is_numeric "$HW_THERMAL_US"; then HW_THERMAL_US=0; fi

    RECOMMENDATIONS=()
    local rec
    rec=$(build_recommendations "$health")
    if [[ -n "$rec" ]]; then
        RECOMMENDATIONS+=("$rec")
    fi
}

# @function json_escape
# Escape string for JSON embedding.
# @param $1  Raw string.

json_escape() {
    local s="${1:-}"
    s=${s//\\/\\\\}
    s=${s//\"/\\\"}
    echo "$s"
}

# @function emit_recommendations_json
# Emit RECOMMENDATIONS array as JSON fragment.

emit_recommendations_json() {
    local first=true item escaped
    echo -n "["
    if ((${#RECOMMENDATIONS[@]} > 0)); then
        for item in "${RECOMMENDATIONS[@]}"; do
            escaped=$(json_escape "$item")
            if [[ "$first" == true ]]; then
                first=false
            else
                echo -n ","
            fi
            echo -n "\"${escaped}\""
        done
    fi
    echo -n "]"
}

# --- Core verbs ---

# @function status
# Report GPU clock lock status (text or --json).
# @param $1  Optional --json flag.

status() {
    check_tool nvidia-smi
    collect_status_data

    if [[ "${1:-}" == "--json" ]]; then
        local locked_json rec_json
        if [[ "$LOCKED" == "true" ]]; then locked_json=true; else locked_json=false; fi
        rec_json=$(emit_recommendations_json)
        cat <<JSON
{
  "target_mhz": ${CLOCK_CEILING_MHZ},
  "floor_mhz": ${CLOCK_FLOOR_MHZ},
  "ceiling_mhz": ${CLOCK_CEILING_MHZ},
  "configured_floor_mhz": "${CONFIG_FLOOR:-}",
  "configured_ceiling_mhz": "${CONFIG_CEILING:-}",
  "current_mhz": ${CURRENT_MHZ},
  "locked": ${locked_json},
  "at_target": ${AT_TARGET},
  "health": "${HEALTH}",
  "temperature_c": ${TEMP_C},
  "tlimit_margin_c": ${TLIMIT_C},
  "power_w": ${POWER_W},
  "utilization_pct": ${UTIL_PCT},
  "throttle_active": "$(json_escape "${THROTTLE_ACTIVE:-None}")",
  "throttle_counters_us": {
    "sw_power_capping": ${SW_POWER_CAP_US},
    "sw_thermal_slowdown": ${SW_THERMAL_US},
    "hw_thermal_slowdown": ${HW_THERMAL_US}
  },
  "supported_max_mhz": "${SUPPORTED_MAX}",
  "applications_clock_mhz": ${APPS_MHZ},
  "recommendations": ${rec_json},
  "service": "${SERVICE_STATE}",
  "persistence_mode": "${PERSISTENCE:-unknown}"
}
JSON
        return 0
    fi

    echo "------------------------------------------------"
    echo "DGX Spark GPU Clock Status"
    echo "------------------------------------------------"
    echo "Target range           : ${CLOCK_FLOOR_MHZ}–${CLOCK_CEILING_MHZ} MHz"
    echo "Configured range       : ${CONFIG_FLOOR:-unlocked}–${CONFIG_CEILING:-unlocked} MHz"
    echo "Current graphics clock : ${CURRENT_MHZ} MHz"
    echo "Lock active            : ${LOCKED}"
    echo "At target (idempotent) : $( [[ "$AT_TARGET" == true ]] && echo "YES (no-op on run)" || echo "NO (run will lock)" )"
    echo "Health                 : ${HEALTH}"
    echo "Temperature            : ${TEMP_C} C (T.Limit margin: ${TLIMIT_C} C)"
    echo "Power / Utilization    : ${POWER_W} W / ${UTIL_PCT} %"
    echo "Throttle (active)      : ${THROTTLE_ACTIVE:-None}"
    echo "Supported max          : ${SUPPORTED_MAX} MHz"
    echo "Systemd service        : ${SERVICE_STATE}"
    if ((${#RECOMMENDATIONS[@]} > 0)); then
        echo "Recommendations        :"
        local rec
        for rec in "${RECOMMENDATIONS[@]}"; do
            echo "  - ${rec}"
        done
    fi
    echo "------------------------------------------------"
}

# @function apply_lock_range
# Apply nvidia-smi -lgc floor,ceiling (requires root).
# @param $1  Floor MHz.
# @param $2  Ceiling MHz.

apply_lock_range() {
    local floor="${1:-}" ceiling="${2:-}"
    require_root "run"

    if [[ -z "$floor" || -z "$ceiling" ]]; then
        err "Invalid lock range: ${floor},${ceiling}"
        return 1
    fi
    if ! is_numeric "$floor" || ! is_numeric "$ceiling"; then
        err "Lock range must be numeric MHz values"
        return 1
    fi
    if ! awk -v f="$floor" -v c="$ceiling" 'BEGIN { exit (f<c) ? 0 : 1 }'; then
        err "Floor (${floor}) must be less than ceiling (${ceiling})"
        return 1
    fi

    nvidia_smi_exec -pm 1 >/dev/null 2>&1 || warn "Could not set persistence mode (may already be enabled)"

    log "Locking graphics clocks to ${floor},${ceiling} MHz (current: $(nvidia-smi --query-gpu=clocks.current.graphics --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -d ' ') MHz)..."
    if nvidia_smi_exec -lgc "${floor},${ceiling}"; then
        log "Success. Configured range: $(get_configured_lock_range)"
        return 0
    fi
    err "Failed to lock clocks"
    return 1
}

# @function run
# Idempotently lock clocks to configured target range.

run() {
    check_tool nvidia-smi
    collect_status_data

    if [[ "$HEALTH" == "pd_degraded" ]]; then
        warn "PD-degraded state detected. Clock lock may not help until power brick is power-cycled."
        build_recommendations "pd_degraded" | while read -r line; do warn "$line"; done
    fi

    if is_lock_at_target; then
        log "Clocks already locked at target (${CLOCK_FLOOR_MHZ},${CLOCK_CEILING_MHZ} MHz). Idempotent no-op."
        return 0
    fi

    apply_lock_range "$CLOCK_FLOOR_MHZ" "$CLOCK_CEILING_MHZ"
}

# @function reset
# Unlock graphics clocks via nvidia-smi -rgc.

reset() {
    check_tool nvidia-smi
    require_root "reset"
    log "Unlocking graphics clocks (restoring auto-boost)..."
    nvidia_smi_exec -rgc || true
    log "Current: $(nvidia-smi --query-gpu=clocks.current.graphics --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -d ' ') MHz"
}

# @function set_clock
# Set custom clock ceiling or floor,ceiling range.
# @param $1  MHz spec (ceiling or floor,ceiling).

set_clock() {
    local spec="${1:-}"
    [[ -z "$spec" ]] && { err "Usage: set <ceiling_mhz> or set <floor>,<ceiling>"; exit 1; }
    check_tool nvidia-smi

    local floor ceiling
    if [[ "$spec" == *,* ]]; then
        floor="${spec%%,*}"
        ceiling="${spec##*,}"
    else
        floor="$CLOCK_FLOOR_MHZ"
        ceiling="$spec"
    fi

    apply_lock_range "$floor" "$ceiling"
}

# @function diagnose
# Sample GPU telemetry and detect PD/thermal degradation.

diagnose() {
    check_tool nvidia-smi
    local i row health
    local degraded_samples=0

    log "Sampling GPU telemetry (${DIAGNOSE_SAMPLES} samples, ${DIAGNOSE_INTERVAL_S}s interval)..."

    for ((i=1; i<=DIAGNOSE_SAMPLES; i++)); do
        row=$(nvidia_query)
        parse_gpu_row "$row"
        health=$(classify_health "$TEMP_C" "$UTIL_PCT" "$POWER_W" "$CURRENT_MHZ" "$THROTTLE_ACTIVE" "true")

        printf "  sample %2d: temp=%sC power=%sW util=%s%% clock=%sMHz health=%s throttle=%s\n" \
            "$i" "${TEMP_C:-?}" "${POWER_W:-?}" "${UTIL_PCT:-?}" "${CURRENT_MHZ:-?}" "$health" "${THROTTLE_ACTIVE:-None}"

        if [[ "$health" == "pd_degraded" || "$health" == "thermal_throttling" ]]; then
            degraded_samples=$((degraded_samples + 1))
        fi

        if [[ "$i" -lt "$DIAGNOSE_SAMPLES" ]]; then
            sleep "$DIAGNOSE_INTERVAL_S"
        fi
    done

    echo "------------------------------------------------"
    if [[ "$degraded_samples" -gt 0 ]]; then
        err "Degraded samples: ${degraded_samples}/${DIAGNOSE_SAMPLES}"
        build_recommendations "pd_degraded" | while read -r line; do warn "$line"; done
        return 1
    fi
    log "PASS — no PD-degraded or thermal-throttle signatures in sample window."
    return 0
}

# --- Systemd service management ---

# @function install_service
# Install and enable systemd oneshot clock optimization service.

install_service() {
    check_tool systemctl
    require_root "--enable-systemd-service"
    log "Installing spark-clock optimization service (idempotent)..."

    if [[ "$0" != "$SCRIPT_INSTALL_PATH" ]]; then
        cp "$0" "$SCRIPT_INSTALL_PATH"
        chmod +x "$SCRIPT_INSTALL_PATH"
        log "Script installed to $SCRIPT_INSTALL_PATH"
    fi

    local desired_unit
    desired_unit=$(cat <<EOF
[Unit]
Description=Optimize NVIDIA GPU Clocks for DGX Spark Stability
After=nvidia-persistenced.service
Wants=nvidia-persistenced.service

[Service]
Type=oneshot
ExecStart=$SCRIPT_INSTALL_PATH run
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
)

    local current_unit=""
    if [[ -f "$SERVICE_PATH" ]]; then
        current_unit=$(cat "$SERVICE_PATH")
    fi

    if [[ "$current_unit" != "$desired_unit" ]]; then
        echo "$desired_unit" > "$SERVICE_PATH"
        log "Systemd unit written/updated"
    else
        log "Systemd unit already correct (idempotent)"
    fi

    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    systemctl start "$SERVICE_NAME"
    log "Service $SERVICE_NAME enabled and started."
}

# @function remove_service
# Disable and remove systemd clock optimization service.

remove_service() {
    check_tool systemctl
    require_root "--disable-systemd-service"
    log "Removing spark-clock optimization service..."
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl disable "$SERVICE_NAME" 2>/dev/null || true
    rm -f "$SERVICE_PATH"
    systemctl daemon-reload
    log "Service removed (clocks left unchanged; run reset manually if needed)."
}

# --- Main ---

case "${1:-}" in
    status)
        status "${2:-}"
        ;;
    run|optimize)
        run
        ;;
    reset)
        reset
        ;;
    set)
        set_clock "${2:-}"
        ;;
    diagnose)
        diagnose
        ;;
    --enable-systemd-service)
        install_service
        ;;
    --disable-systemd-service)
        remove_service
        ;;
    --help|help|-h)
        echo "spark-clock utility — DGX Spark GB10 thermal stability via clock range lock"
        echo "Usage: $0 {status [--json]|run|reset|set <mhz>|set <floor>,<ceiling>|diagnose|--enable-systemd-service|--disable-systemd-service}"
        ;;
    *)
        echo "Usage: $0 {status [--json]|run|reset|set <mhz>|set <floor>,<ceiling>|diagnose|--enable-systemd-service|--disable-systemd-service}"
        exit 1
        ;;
esac
