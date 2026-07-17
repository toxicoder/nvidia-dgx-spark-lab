#!/usr/bin/env bash
#
# ## download-flux
#
# Download FLUX.2 checkpoints for ComfyUI visual workloads on DGX Spark.
#
# Tiers:
#   --tier fast      black-forest-labs/FLUX.2-klein-9b-nvfp4 (+ optional Nunchaku)
#   --tier quality   black-forest-labs/FLUX.2-dev (FP8-oriented Comfy layout)
#   --tier all       fast + quality
#
# Usage:
#   ./scripts/utilities/download-flux.sh status [--tier ...] [--json]
#   ./scripts/utilities/download-flux.sh run [--tier ...]
#
# Weights land under MODELS_DIR (default /mnt/models) with Comfy-friendly layout.
#
# @command download-flux

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
INCLUDE_NUNCHAKU="${INCLUDE_NUNCHAKU:-1}"

# @function tier_repo
# Map tier id to primary Hugging Face repo id.
tier_repo() {
  case "$1" in
    fast) echo "black-forest-labs/FLUX.2-klein-9b-nvfp4" ;;
    quality) echo "black-forest-labs/FLUX.2-dev" ;;
    nunchaku) echo "tonera/FLUX.2-klein-9B-Nunchaku" ;;
    *) echo "" ;;
  esac
}

# @function tier_min_gb
# Minimum on-disk GB required for tier readiness.
tier_min_gb() {
  case "$1" in
    fast) echo 12 ;;
    quality) echo 30 ;;
    nunchaku) echo 4 ;;
    *) echo 0 ;;
  esac
}

# @function tier_dir
# Local download directory for a tier.
tier_dir() {
  local repo
  repo=$(tier_repo "$1")
  echo "${MODELS_DIR}/$(echo "${repo}" | tr '/' '__')"
}

# @function comfy_link_dir
# ComfyUI models subdir for tier (under MODELS_DIR/comfy).
comfy_link_dir() {
  case "$1" in
    fast | nunchaku) echo "${MODELS_DIR}/comfy/diffusion_models" ;;
    quality) echo "${MODELS_DIR}/comfy/diffusion_models" ;;
    *) echo "${MODELS_DIR}/comfy" ;;
  esac
}

# @function check_hf_cli
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
hf_download() {
  if command -v huggingface-cli >/dev/null 2>&1; then
    huggingface-cli download "$@"
  else
    hf download "$@"
  fi
}

# @function tier_size_gb
tier_size_gb() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    echo 0
    return
  fi
  du -sk "$dir" 2>/dev/null | awk '{printf "%.1f", $1/1024/1024}'
}

# @function tiers_to_process
tiers_to_process() {
  case "$TIER" in
    all)
      if [[ "${INCLUDE_NUNCHAKU}" == "1" ]]; then
        echo "fast nunchaku quality"
      else
        echo "fast quality"
      fi
      ;;
    fast)
      if [[ "${INCLUDE_NUNCHAKU}" == "1" ]]; then
        echo "fast nunchaku"
      else
        echo "fast"
      fi
      ;;
    quality) echo "quality" ;;
    nunchaku) echo "nunchaku" ;;
    *) echo "$TIER" ;;
  esac
}

# @function parse_args
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json) JSON_FLAG="--json" ;;
      --tier) TIER="${2:?}"; shift ;;
      --no-nunchaku) INCLUDE_NUNCHAKU=0 ;;
      status | run) CMD="$1" ;;
      *) err "Unknown arg: $1"; exit 1 ;;
    esac
    shift
  done
}

# @function cmd_status
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
    printf '{"tiers":[%s],"models_dir":"%s"}\n' "$joined" "$MODELS_DIR"
  else
    for tier in $(tiers_to_process); do
      dir=$(tier_dir "$tier")
      size=$(tier_size_gb "$dir")
      log "${tier}: $(tier_repo "$tier") — ${size} GB at ${dir}"
    done
  fi
}

# @function link_into_comfy
# Best-effort symlink snapshot files into Comfy diffusion_models dir.
link_into_comfy() {
  local tier="$1"
  local src dest
  src=$(tier_dir "$tier")
  dest=$(comfy_link_dir "$tier")
  mkdir -p "$dest"
  if [[ ! -d "$src" ]]; then
    return 0
  fi
  # Symlink top-level safetensors into Comfy folder (idempotent).
  find "$src" -maxdepth 3 -type f \( -name '*.safetensors' -o -name '*.sft' \) 2>/dev/null | while read -r f; do
    local base
    base=$(basename "$f")
    if [[ ! -e "${dest}/${base}" ]]; then
      ln -sfn "$f" "${dest}/${base}" || true
    fi
  done
}

# @function cmd_run
cmd_run() {
  check_hf_cli
  mkdir -p "$MODELS_DIR" "${MODELS_DIR}/comfy/diffusion_models" \
    "${MODELS_DIR}/comfy/text_encoders" "${MODELS_DIR}/comfy/vae"
  local tier repo
  for tier in $(tiers_to_process); do
    repo=$(tier_repo "$tier")
    if [[ -z "$repo" ]]; then
      err "Unknown tier: $tier"
      exit 1
    fi
    log "Downloading ${repo} (tier: ${tier})..."
    HF_HOME="${MODELS_DIR}" hf_download "$repo" --local-dir "$(tier_dir "$tier")" || {
      warn "Download failed for ${repo} (gated license or network). Continue with other tiers."
      continue
    }
    link_into_comfy "$tier"
  done
  cmd_status
}

parse_args "$@"
case "$CMD" in
  status) cmd_status ;;
  run) cmd_run ;;
  *)
    err "Usage: $0 status|run [--tier fast|quality|nunchaku|all] [--no-nunchaku] [--json]"
    exit 1
    ;;
esac
