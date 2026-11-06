#!/usr/bin/env bash
#
# ## download-glm53-flash-exl3
#
# Download the GLM-5.3-Flash EXL3 TensorFold checkpoint and its DFlash2 drafter.
#
# Repos: Mia-AiLab/GLM-5.3-Flash-EXL3-4bpw-TensorFold (~176 GB) and
# incoai/GLM-5.3-Flash-DFlash2 (~2.3 GB, drafter, CC BY-NC-ND 4.0 non-commercial).
# Set DRAFTER=mtp in the Job instead of fetching the drafter for commercial use.
#
# Gated -Ablit variants (Mia-AiLab/GLM-5.3-Flash-EXL3-4bpw-TensorFold-Ablit,
# gorbatjovy/GLM-5.3-Flash-DFlash2-ablit-fc) are optional and only fetched when
# HF_TOKEN is exported and the repo terms were accepted.
#
# The snapshot must exist on BOTH Sparks of the pair (each node mounts its own
# /mnt/models as /models with HF_HUB_OFFLINE=1). Budget ~205 GB of disk per node.
#
# Usage:
#   bazelisk run //scripts:run-utility -- download-glm53-flash-exl3 status [--json]
#   bazelisk run //scripts:run-utility -- download-glm53-flash-exl3 run
#
# @command download-glm53-flash-exl3

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
HF_REPO="Mia-AiLab/GLM-5.3-Flash-EXL3-4bpw-TensorFold"
DRAFTER_REPO="incoai/GLM-5.3-Flash-DFlash2"
ABLIT_REPO="Mia-AiLab/GLM-5.3-Flash-EXL3-4bpw-TensorFold-Ablit"
MIN_GB=170
MIN_GB_DRAFTER=2

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

# @function size_ready
# Echo true when a directory holds at least the given GB.
size_ready() {
  local size="$1" min="$2"
  if awk "BEGIN {exit !($size >= $min)}"; then
    echo true
  else
    echo false
  fi
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

# @function download_repo
# Download one Hugging Face repo into MODELS_DIR.
download_repo() {
  local repo="$1" dir
  dir=$(repo_dir "$repo")
  log "Downloading ${repo} to ${dir}..."
  HF_HOME="${MODELS_DIR}" hf_download "$repo" --local-dir "$dir"
}

# @function download_ablit
# Fetch the gated -Ablit checkpoint when HF_TOKEN is set; skip silently otherwise.
download_ablit() {
  if [[ -z ${HF_TOKEN:-} ]]; then
    warn "HF_TOKEN not set: skipping gated ${ABLIT_REPO}."
    return 0
  fi
  download_repo "$ABLIT_REPO"
}

# @function cmd_status
# Print download readiness for the EXL3 checkpoint, the drafter, and the optional ablit.
cmd_status() {
  local dir size ready drafter drafter_size drafter_ready ablit_dir ablit_ready
  dir=$(repo_dir "$HF_REPO")
  size=$(dir_size_gb "$dir")
  ready=$(size_ready "$size" "$MIN_GB")
  drafter=$(repo_dir "$DRAFTER_REPO")
  drafter_size=$(dir_size_gb "$drafter")
  drafter_ready=$(size_ready "$drafter_size" "$MIN_GB_DRAFTER")
  ablit_dir=$(repo_dir "$ABLIT_REPO")
  ablit_ready="false"
  if [[ -d $ablit_dir ]]; then
    ablit_ready="true"
  fi
  if [[ $JSON_FLAG == "--json" ]]; then
    printf '{"repo":"%s","path":"%s","size_gb":%s,"min_gb":%s,"ready":%s,"drafter_repo":"%s","drafter_path":"%s","drafter_ready":%s,"ablit_repo":"%s","ablit_path":"%s","ablit_ready":%s,"hf_token":%s}\n' \
      "$HF_REPO" "$dir" "$size" "$MIN_GB" "$ready" \
      "$DRAFTER_REPO" "$drafter" "$drafter_ready" \
      "$ABLIT_REPO" "$ablit_dir" "$ablit_ready" "$([[ -n ${HF_TOKEN:-} ]] && echo true || echo false)"
  else
    log "repo: ${HF_REPO} - ${size} GB at ${dir} (min ${MIN_GB} GB, ready=${ready})"
    log "drafter: ${DRAFTER_REPO} - ${drafter_size} GB at ${drafter} (ready=${drafter_ready})"
    log "  DFlash2 drafter is CC BY-NC-ND 4.0 (non-commercial); use DRAFTER=mtp otherwise."
    log "gated ablit: ${ABLIT_REPO} at ${ablit_dir} (present=${ablit_ready}; needs HF_TOKEN + accepted terms)"
    log "Run on BOTH Sparks of the pair; budget ~205 GB disk per node."
    log "Next: bazelisk run //:manage -- start-glm53-flash-exl3 (heavy confirm, one lane at a time)."
  fi
}

# @function cmd_run
# Download the EXL3 checkpoint, the drafter, and the gated ablit into MODELS_DIR.
cmd_run() {
  check_hf_cli
  mkdir -p "$MODELS_DIR"
  download_repo "$HF_REPO"
  download_repo "$DRAFTER_REPO"
  download_ablit
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
