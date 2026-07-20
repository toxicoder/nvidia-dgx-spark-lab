#!/usr/bin/env bash
#
# ## download-ltx
#
# Download LTX-2.3 ComfyUI components (Kijai split checkpoints).
#
# Tiers:
#   --tier balanced  distilled FP8 (default for speed)
#   --tier quality   BF16 distilled / full-precision family weights
#   --tier all       balanced + quality
#
# Usage:
#   ./scripts/utilities/download-ltx.sh status [--tier ...] [--json]
#   ./scripts/utilities/download-ltx.sh run [--tier ...]
#
# @command download-ltx

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
# Map tier id to primary Hugging Face repo id.
tier_repo() {
  case "$1" in
    balanced | quality) echo "Kijai/LTX2.3_comfy" ;;
    *) echo "" ;;
  esac
}

# @function tier_min_gb
# Shared HF repo; quality may pull larger BF16 files (min GB differs).
tier_min_gb() {
  case "$1" in
    balanced) echo 20 ;;
    quality) echo 35 ;;
    *) echo 0 ;;
  esac
}

# @function tier_dir
# Local download directory for a tier (separate paths per tier).
tier_dir() {
  local repo
  repo=$(tier_repo "$1")
  # Separate local dirs so quality can re-snapshot if needed.
  echo "${MODELS_DIR}/$(echo "${repo}" | tr '/' '__')_${1}"
}

# @function check_hf_cli
# Require huggingface-cli or hf on PATH.
check_hf_cli() {
  if command -v huggingface-cli >/dev/null 2>&1 || command -v hf >/dev/null 2>&1; then
    return 0
  fi
  err "Required tool missing: huggingface-cli or hf (pip install -U huggingface_hub)"
  exit 1
}

# @function hf_download
# Invoke huggingface-cli download or hf download with the given args.
hf_download() {
  if command -v huggingface-cli >/dev/null 2>&1; then
    huggingface-cli download "$@"
  else
    hf download "$@"
  fi
}

# @function tier_size_gb
# On-disk size of a directory in GB (0 if missing).
tier_size_gb() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    echo 0
    return
  fi
  du -sk "$dir" 2>/dev/null | awk '{printf "%.1f", $1/1024/1024}'
}

# @function tiers_to_process
# Expand TIER into the list of tier ids to process.
tiers_to_process() {
  case "$TIER" in
    all) echo "balanced quality" ;;
    *) echo "$TIER" ;;
  esac
}

# @function parse_args
# Parse CLI flags into CMD, TIER, and JSON_FLAG.
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json) JSON_FLAG="--json" ;;
      --tier) TIER="${2:?}"; shift ;;
      status | run) CMD="$1" ;;
      *) err "Unknown arg: $1"; exit 1 ;;
    esac
    shift
  done
}

# @function link_into_comfy
# Best-effort symlink snapshot files into Comfy model subdirs.
link_into_comfy() {
  local tier="$1"
  local src="${MODELS_DIR}/comfy"
  mkdir -p "${src}/diffusion_models" "${src}/text_encoders" "${src}/vae" "${src}/checkpoints"
  local dir
  dir=$(tier_dir "$tier")
  [[ -d "$dir" ]] || return 0
  find "$dir" -type f \( -name '*.safetensors' -o -name '*.sft' -o -name '*.gguf' \) 2>/dev/null | while read -r f; do
    local base dest_sub
    base=$(basename "$f")
    dest_sub="diffusion_models"
    case "$base" in
      *text* | *gemma* | *te*) dest_sub="text_encoders" ;;
      *vae* | *audio*) dest_sub="vae" ;;
    esac
    if [[ ! -e "${src}/${dest_sub}/${base}" ]]; then
      ln -sfn "$f" "${src}/${dest_sub}/${base}" || true
    fi
  done
}

# @function cmd_status
# Print tier readiness (JSON with --json).
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

# @function cmd_run
# Download selected tiers and link into Comfy paths.
cmd_run() {
  check_hf_cli
  mkdir -p "$MODELS_DIR"
  local tier repo
  for tier in $(tiers_to_process); do
    repo=$(tier_repo "$tier")
    log "Downloading ${repo} (tier: ${tier})..."
    HF_HOME="${MODELS_DIR}" hf_download "$repo" --local-dir "$(tier_dir "$tier")" || {
      warn "Download failed for ${repo} (${tier}). Continue."
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
    err "Usage: $0 status|run [--tier balanced|quality|all] [--json]"
    exit 1
    ;;
esac
