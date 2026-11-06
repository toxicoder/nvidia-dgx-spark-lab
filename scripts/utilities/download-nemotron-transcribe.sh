#!/usr/bin/env bash
#
# ## download-nemotron-transcribe
#
# Download the NVIDIA Nemotron 3.5 Transcribe 30B-A4B NVFP4 checkpoint.
#
# Official repo only: nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-NVFP4.
# The lane serves the snapshot from /models, so the download must land at
#   /mnt/models/nvidia__NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-NVFP4
# which is exactly what MODEL_NAME in the Deployment points at.
#
# NVFP4 needs a Blackwell GPU (DGX Spark GB10). The BF16 / FP8 siblings are for
# non-Blackwell hosts only; do not swap them into this lane.
#
# Usage:
#   bazelisk run //scripts:run-utility -- download-nemotron-transcribe status [--json]
#   bazelisk run //scripts:run-utility -- download-nemotron-transcribe run
#
# @command download-nemotron-transcribe

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
HF_REPO="nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-NVFP4"
MIN_GB=15

# @function repo_dir
# Local directory for the official Hugging Face snapshot. The org separator
# becomes a double underscore so the path matches MODEL_NAME in the Deployment;
# tr cannot emit two chars for one input, hence the bash expansion.
repo_dir() {
  echo "${MODELS_DIR}/${HF_REPO//\//__}"
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
# Print download readiness for the official NVFP4 snapshot.
cmd_status() {
  local dir size ready
  dir=$(repo_dir)
  size=$(dir_size_gb "$dir")
  ready="false"
  if awk "BEGIN {exit !($size >= $MIN_GB)}"; then
    ready="true"
  fi
  if [[ $JSON_FLAG == "--json" ]]; then
    printf '{"repo":"%s","path":"%s","size_gb":%s,"min_gb":%s,"ready":%s}\n' \
      "$HF_REPO" "$dir" "$size" "$MIN_GB" "$ready"
  else
    log "repo: ${HF_REPO} - ${size} GB at ${dir} (min ${MIN_GB} GB, ready=${ready})"
    log "Served as MODEL_NAME=/models/$(basename "$dir")"
    log "Next: build nemotron-3.5-transcribe:local on a Blackwell host, then start the lane."
    log "NVFP4 requires Blackwell (DGX Spark GB10); the BF16/FP8 siblings are for other hosts."
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
