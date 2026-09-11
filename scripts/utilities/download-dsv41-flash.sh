#!/usr/bin/env bash
#
# ## download-dsv41-flash
#
# Download the official DeepSeek-V4.1-Flash checkpoint for exclusive Mode C.
#
# Official repo only: deepseek-ai/DeepSeek-V4.1-Flash (~476–510 GB).
# Does not pull nvidia/DeepSeek-V4-Flash-NVFP4 (old 284B) or LibertAIDAI requants.
#
# After download, pack Engram shards onto each node's NVMe:
#   follow MiaAI-Lab DeepSeek-v4.1-Flash-DGX-Sparks ./start.sh pack
#   destination: /mnt/models/dsv41-engram
# Never OFFLOAD_MODE=ram.
#
# Usage:
#   ./scripts/utilities/download-dsv41-flash.sh status [--json]
#   ./scripts/utilities/download-dsv41-flash.sh run
#
# @command download-dsv41-flash

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
JSON_FLAG=""
CMD="status"
HF_REPO="deepseek-ai/DeepSeek-V4.1-Flash"
MIN_GB=400
ENGRAM_DIR="${MODELS_DIR}/dsv41-engram"

# @function repo_dir
# Local directory for the official Hugging Face snapshot.
repo_dir() {
  echo "${MODELS_DIR}/$(echo "${HF_REPO}" | tr '/' '__')"
}

# @function dir_size_gb
# On-disk size of a directory in GB, or 0 if missing.
dir_size_gb() {
  local dir="$1"
  if [[ ! -d $dir ]]; then
    echo 0
    return
  fi
  du -sk "$dir" 2>/dev/null | awk '{printf "%.1f", $1/1024/1024}'
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

# @function cmd_status
# Print download readiness for the official V4.1-Flash snapshot.
cmd_status() {
  local dir size ready
  dir=$(repo_dir)
  size=$(dir_size_gb "$dir")
  ready="false"
  if awk "BEGIN {exit !($size >= $MIN_GB)}"; then
    ready="true"
  fi
  if [[ $JSON_FLAG == "--json" ]]; then
    printf '{"repo":"%s","path":"%s","size_gb":%s,"min_gb":%s,"ready":%s,"engram_dir":"%s"}\n' \
      "$HF_REPO" "$dir" "$size" "$MIN_GB" "$ready" "$ENGRAM_DIR"
  else
    log "repo: ${HF_REPO} — ${size} GB at ${dir} (min ${MIN_GB} GB, ready=${ready})"
    log "Engram pack dest (each node NVMe): ${ENGRAM_DIR}"
    log "Next: clone MiaAI-Lab/DeepSeek-v4.1-Flash-DGX-Sparks and run ./start.sh pack. Never OFFLOAD_MODE=ram."
    log "Do not download nvidia/DeepSeek-V4-Flash-NVFP4 or LibertAIDAI requants."
  fi
}

# @function cmd_run
# Download the official checkpoint into MODELS_DIR.
cmd_run() {
  check_hf_cli
  mkdir -p "$MODELS_DIR"
  local dir
  dir=$(repo_dir)
  log "Downloading ${HF_REPO} to ${dir}..."
  HF_HOME="${MODELS_DIR}" hf_download "$HF_REPO" --local-dir "$dir"
  mkdir -p "$ENGRAM_DIR"
  cmd_status
}

# @function main
# CLI entry: status|run [--json].
main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json) JSON_FLAG="--json" ;;
      status | run) CMD="$1" ;;
      *)
        err "Usage: $0 status|run [--json]"
        exit 1
        ;;
    esac
    shift
  done
  case "$CMD" in
    status) cmd_status ;;
    run) cmd_run ;;
    *)
      err "Usage: $0 status|run [--json]"
      exit 1
      ;;
  esac
}

if [[ ${BASH_SOURCE[0]} == "${0}" ]]; then
  main "$@"
fi
