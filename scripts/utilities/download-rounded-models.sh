#!/usr/bin/env bash
#
# ## download-rounded-models
#
# Download checkpoints for the 3-node LiteLLM rounded stack.
#
# Tiers:
#   --tier flash-next  RadixArk/Qwen3.8-Flash-Next-NVFP4 (~130 GB)
#   --tier medgemma    google/medgemma-27b-multimodal (HAI-DEF gated)
#   --tier glm53       local-inference-lab/GLM-5.3-Flash-NVFP4 (~185 GB)
#   --tier all         All of the above (default)
#
# Usage:
#   ./scripts/utilities/download-rounded-models.sh status [--tier ...] [--json]
#   ./scripts/utilities/download-rounded-models.sh run [--tier ...]
#
# @command download-rounded-models

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
tier_repo() {
  case "$1" in
    flash-next) echo "RadixArk/Qwen3.8-Flash-Next-NVFP4" ;;
    medgemma) echo "google/medgemma-27b-multimodal" ;;
    glm53) echo "local-inference-lab/GLM-5.3-Flash-NVFP4" ;;
    *) echo "" ;;
  esac
}

# @function tier_min_gb
# Minimum on-disk GB required for tier readiness.
tier_min_gb() {
  case "$1" in
    flash-next) echo 100 ;;
    medgemma) echo 20 ;;
    glm53) echo 150 ;;
    *) echo 0 ;;
  esac
}

# @function tier_dir
# Local directory for a tier's Hugging Face snapshot.
tier_dir() {
  local repo
  repo=$(tier_repo "$1")
  echo "${MODELS_DIR}/$(echo "${repo}" | tr '/' '__')"
}

# @function check_hf_cli
# Require huggingface-cli or hf.
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
# Invoke huggingface-cli download or hf download.
hf_download() {
  if command -v huggingface-cli >/dev/null 2>&1; then
    huggingface-cli download "$@"
  else
    hf download "$@"
  fi
}

# @function tier_size_gb
# On-disk size of a directory in GB, or 0 if missing.
tier_size_gb() {
  local dir="$1"
  if [[ ! -d $dir ]]; then
    echo 0
    return
  fi
  du -sk "$dir" 2>/dev/null | awk '{printf "%.1f", $1/1024/1024}'
}

# @function tiers_to_process
# Expand --tier all into the concrete tier list.
tiers_to_process() {
  case "$TIER" in
    all) echo "flash-next medgemma glm53" ;;
    *) echo "$TIER" ;;
  esac
}

# @function parse_args
# Parse status|run, --tier, and --json.
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json) JSON_FLAG="--json" ;;
      --tier)
        TIER="${2:?}"
        shift
        ;;
      status | run) CMD="$1" ;;
      *)
        err "Unknown arg: $1"
        exit 1
        ;;
    esac
    shift
  done
}

# @function cmd_status
# Print download readiness for selected tiers.
cmd_status() {
  local results=()
  local tier repo dir size min ready
  for tier in $(tiers_to_process); do
    repo=$(tier_repo "$tier")
    if [[ -z $repo ]]; then
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
  if [[ $JSON_FLAG == "--json" ]]; then
    local joined
    joined=$(
      IFS=,
      echo "${results[*]}"
    )
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
# Download selected tier checkpoints into MODELS_DIR.
cmd_run() {
  check_hf_cli
  mkdir -p "$MODELS_DIR"
  local tier repo
  for tier in $(tiers_to_process); do
    repo=$(tier_repo "$tier")
    if [[ -z $repo ]]; then
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
  *)
    err "Usage: $0 status|run [--tier flash-next|medgemma|glm53|all] [--json]"
    exit 1
    ;;
esac
