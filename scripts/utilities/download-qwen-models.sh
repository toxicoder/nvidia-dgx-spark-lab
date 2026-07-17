#!/usr/bin/env bash
#
# ## download-qwen-models
#
# Download Qwen 3.5 tier models and Qwen3.6 dual-stack NVFP4 checkpoints.
#
# Tiers (Qwen 3.5 substitutes when nvidia/Qwen3.5-397B-A17B-NVFP4 does not fit):
#   --tier 122b         RedHatAI/Qwen3.5-122B-A10B-NVFP4 (~75 GB, 1-node)
#   --tier 397b-spark2  Intel/Qwen3.5-397B-A17B-int4-AutoRound (~200 GB, 2-node)
#   --tier 397b-nvfp4   nvidia/Qwen3.5-397B-A17B-NVFP4 (~250 GB, 4-node)
#
# Qwen3.6 dual stack (1× Spark):
#   --tier 27b-nvfp4       unsloth/Qwen3.6-27B-NVFP4
#   --tier 35b-a3b-nvfp4   unsloth/Qwen3.6-35B-A3B-NVFP4-Fast
#   --tier qwen36          Both Qwen3.6 NVFP4 tiers
#   --tier all             All Qwen 3.5 tiers (default; does not include qwen36)
#
# Usage:
#   ./scripts/utilities/download-qwen-models.sh status [--tier ...] [--json]
#   ./scripts/utilities/download-qwen-models.sh run [--tier ...]
#
# @command download-qwen-models

set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
SCRIPT_DIR="$(lab_script_dir 1 utilities)"

if [[ -f "${SCRIPT_DIR}/../lib/common.sh" ]]; then
    # shellcheck source=../lib/common.sh
    source "${SCRIPT_DIR}/../lib/common.sh"
fi

: "${log:=echo}"
: "${warn:=echo >&2}"
: "${err:=echo >&2}"

MODELS_DIR=${MODELS_DIR:-"/mnt/models"}
TIER="all"
JSON_FLAG=""
CMD="status"

# @function tier_repo
# Map tier id to Hugging Face repo id.
# @param $1  Tier (122b, 397b-spark2, 397b-nvfp4).

tier_repo() {
    case "$1" in
        122b) echo "RedHatAI/Qwen3.5-122B-A10B-NVFP4" ;;
        397b-spark2) echo "Intel/Qwen3.5-397B-A17B-int4-AutoRound" ;;
        397b-nvfp4) echo "nvidia/Qwen3.5-397B-A17B-NVFP4" ;;
        27b-nvfp4) echo "unsloth/Qwen3.6-27B-NVFP4" ;;
        35b-a3b-nvfp4) echo "unsloth/Qwen3.6-35B-A3B-NVFP4-Fast" ;;
        *) echo "" ;;
    esac
}

# @function tier_min_gb
# Minimum on-disk GB required for tier readiness.
# @param $1  Tier id.

tier_min_gb() {
    case "$1" in
        122b) echo 60 ;;
        397b-spark2) echo 180 ;;
        397b-nvfp4) echo 220 ;;
        27b-nvfp4) echo 14 ;;
        35b-a3b-nvfp4) echo 16 ;;
        *) echo 0 ;;
    esac
}

# @function tier_dir
# Local download directory for a tier.
# @param $1  Tier id.

tier_dir() {
    local repo
    repo=$(tier_repo "$1")
    echo "${MODELS_DIR}/$(echo "${repo}" | tr '/' '__')"
}

# @function check_hf_cli
# Fail if huggingface-cli or hf is not installed.

check_hf_cli() {
    if command -v huggingface-cli >/dev/null 2>&1; then
        return 0
    fi
    if command -v hf >/dev/null 2>&1; then
        return 0
    fi
    err "Required tool missing: huggingface-cli or hf (pip install -U huggingface_hub)"
    exit 1
}

# @function hf_download
# Invoke huggingface-cli or hf download with given args.

hf_download() {
    if command -v huggingface-cli >/dev/null 2>&1; then
        huggingface-cli download "$@"
    else
        hf download "$@"
    fi
}

# @function tier_size_gb
# Report directory size in GB.
# @param $1  Directory path.

tier_size_gb() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        echo 0
        return
    fi
    du -sk "$dir" 2>/dev/null | awk '{printf "%.1f", $1/1024/1024}'
}

# @function tiers_to_process
# Expand TIER=all to space-separated tier list.

tiers_to_process() {
    case "$TIER" in
        all) echo "122b 397b-spark2 397b-nvfp4" ;;
        qwen36) echo "27b-nvfp4 35b-a3b-nvfp4" ;;
        *) echo "$TIER" ;;
    esac
}

# @function parse_args
# Parse CLI flags (--json, --tier) and command (status|run).

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --json) JSON_FLAG="--json" ;;
            --tier) TIER="${2:?}"; shift ;;
            status|run) CMD="$1" ;;
            *) err "Unknown arg: $1"; exit 1 ;;
        esac
        shift
    done
}

# @function cmd_status
# Report download readiness for selected Qwen tiers.

cmd_status() {
    local results=()
    local tier repo dir size min ready
    for tier in $(tiers_to_process); do
        repo=$(tier_repo "$tier")
        if [[ -z "$repo" ]]; then
            err "Unknown tier: $tier"
            exit 1
        fi
        dir=$(tier_dir "$tier")
        size=$(tier_size_gb "$dir")
        min=$(tier_min_gb "$tier")
        ready="false"
        if awk "BEGIN {exit !($size >= $min)}"; then
            ready="true"
        fi
        results+=("{\"tier\":\"$tier\",\"repo\":\"$repo\",\"path\":\"$dir\",\"size_gb\":$size,\"min_gb\":$min,\"ready\":$ready}")
    done
    if [[ "$JSON_FLAG" == "--json" ]]; then
        local joined
        joined=$(IFS=,; echo "${results[*]}")
        printf '{"tiers":[%s]}\n' "$joined"
    else
        for tier in $(tiers_to_process); do
            dir=$(tier_dir "$tier")
            size=$(tier_size_gb "$dir")
            log "${tier}: $(tier_repo "$tier") — ${size} GB at ${dir}"
        done
    fi
}

# @function cmd_run
# Download selected Qwen tier models to MODELS_DIR.

cmd_run() {
    check_hf_cli
    mkdir -p "$MODELS_DIR"
    local tier repo
    for tier in $(tiers_to_process); do
        repo=$(tier_repo "$tier")
        if [[ -z "$repo" ]]; then
            err "Unknown tier: $tier"
            exit 1
        fi
        log "Downloading ${repo} (tier: ${tier})..."
        HF_HOME="${MODELS_DIR}" hf_download "$repo" --local-dir "$(tier_dir "$tier")"
    done
    cmd_status
}

parse_args "$@"
case "$CMD" in
    status) cmd_status ;;
    run) cmd_run ;;
    *) err "Usage: $0 status|run [--tier 122b|397b-spark2|397b-nvfp4|27b-nvfp4|35b-a3b-nvfp4|qwen36|all] [--json]"; exit 1 ;;
esac
