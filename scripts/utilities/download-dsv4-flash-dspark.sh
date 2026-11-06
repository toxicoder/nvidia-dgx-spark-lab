#!/usr/bin/env bash
#
# ## download-dsv4-flash-dspark
#
# Download the official DeepSeek-V4-Flash Vision-Exp checkpoint for the DSpark 2-node pair.
#
# Official repo only: deepseek-ai/DeepSeek-V4-Flash-Vision-Exp (~157 GiB).
# Native image support (ViT + Aligner); no video encoder. Do not swap in the 0731 FP8
# dump or the abandoned 416-byte sparse-MLA experiment.
#
# The gated refusal-direction ablit (drowzeys/keys-DeepSeekV4Flash-Vision-EXP-ablit) is
# optional and only fetched when HF_TOKEN is exported and the repo terms were accepted.
# The lane ships ABLITERATED=0; the ablit direction is an 18 KiB runtime add-on, not a
# second checkpoint.
#
# The snapshot must exist on BOTH Sparks of the pair (each node mounts its own
# /mnt/models as /models with HF_HUB_OFFLINE=1). Run this utility on each host.
#
# Usage:
#   bazelisk run //scripts:run-utility -- download-dsv4-flash-dspark status [--json]
#   bazelisk run //scripts:run-utility -- download-dsv4-flash-dspark run
#
# @command download-dsv4-flash-dspark

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
HF_REPO="deepseek-ai/DeepSeek-V4-Flash-Vision-Exp"
ABLIT_REPO="drowzeys/keys-DeepSeekV4Flash-Vision-EXP-ablit"
MIN_GB=140

# @function repo_dir
# Local directory for a Hugging Face snapshot (org--name flattened with a double underscore).
repo_dir() {
  local flat="${1//\//__}"
  echo "${MODELS_DIR}/${flat}"
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

# @function download_ablit_direction
# Fetch the gated ablit direction when HF_TOKEN is set; skip silently otherwise.
download_ablit_direction() {
  if [[ -z ${HF_TOKEN:-} ]]; then
    warn "HF_TOKEN not set: skipping gated ${ABLIT_REPO} (lane default ABLITERATED=0)."
    return 0
  fi
  local dir
  dir=$(repo_dir "$ABLIT_REPO")
  log "Downloading gated ${ABLIT_REPO} to ${dir}..."
  HF_HOME="${MODELS_DIR}" hf_download "$ABLIT_REPO" --local-dir "$dir"
}

# @function cmd_status
# Print download readiness for the Vision-Exp snapshot and the optional ablit direction.
cmd_status() {
  local dir size ready ablit_dir ablit_ready
  dir=$(repo_dir "$HF_REPO")
  size=$(dir_size_gb "$dir")
  ready="false"
  if awk "BEGIN {exit !($size >= $MIN_GB)}"; then
    ready="true"
  fi
  ablit_dir=$(repo_dir "$ABLIT_REPO")
  ablit_ready="false"
  if [[ -d $ablit_dir ]]; then
    ablit_ready="true"
  fi
  if [[ $JSON_FLAG == "--json" ]]; then
    printf '{"repo":"%s","path":"%s","size_gb":%s,"min_gb":%s,"ready":%s,"ablit_repo":"%s","ablit_path":"%s","ablit_ready":%s,"hf_token":%s}\n' \
      "$HF_REPO" "$dir" "$size" "$MIN_GB" "$ready" \
      "$ABLIT_REPO" "$ablit_dir" "$ablit_ready" "$([[ -n ${HF_TOKEN:-} ]] && echo true || echo false)"
  else
    log "repo: ${HF_REPO} - ${size} GB at ${dir} (min ${MIN_GB} GB, ready=${ready})"
    log "gated ablit: ${ABLIT_REPO} at ${ablit_dir} (present=${ablit_ready}; needs HF_TOKEN + accepted terms)"
    log "Run on BOTH Sparks of the pair; each node serves its own /mnt/models offline."
    log "Next: bazelisk run //:manage -- start-dsv4-flash-dspark (heavy confirm, one lane at a time)."
  fi
}

# @function cmd_run
# Download the official checkpoint (and the gated ablit direction) into MODELS_DIR.
cmd_run() {
  check_hf_cli
  mkdir -p "$MODELS_DIR"
  local dir
  dir=$(repo_dir "$HF_REPO")
  log "Downloading ${HF_REPO} to ${dir}..."
  HF_HOME="${MODELS_DIR}" hf_download "$HF_REPO" --local-dir "$dir"
  download_ablit_direction
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
