#!/usr/bin/env bash
#
# ## download-qwen38-27b-tensorfold
#
# Download the single-DGX-Spark TensorFold checkpoints for Qwen3.8-27B.
#
# Repos (about 19 GB total, plan for ~60 GB free disk on the Spark):
#   Vontra/Qwen3.8-27B-MLX-4bit   affine 4-bit, groups of 64 (~15 GB) - served model
#   z-lab/Qwen3.8-27B-DFlash2      DFlash2 speculative drafter (~3.6 GB)
#
# Both land under MODELS_DIR/<org>__<Model>, which is what the Job mounts at
# /models (HF_HOME=/models). Do not swap in nvidia/Qwen3.8-27B-NVFP4 unless you
# also set VISION=0 - that checkpoint takes no images and decodes slower.
#
# Usage:
#   bazelisk run //scripts:run-utility -- download-qwen38-27b-tensorfold status [--json]
#   bazelisk run //scripts:run-utility -- download-qwen38-27b-tensorfold run
#
# @command download-qwen38-27b-tensorfold

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
TARGET_REPO="Vontra/Qwen3.8-27B-MLX-4bit"
TARGET_MIN_GB=14
DRAFT_REPO="z-lab/Qwen3.8-27B-DFlash2"
DRAFT_MIN_GB=3

# @function repo_dir
# Local directory for a Hugging Face repo snapshot (org__name flattened with a double
# underscore so it matches the MODEL_DIR the Job mounts).
repo_dir() {
  local flat="${1//\//__}"
  echo "${MODELS_DIR}/${flat}"
}

# @function target_dir
# Local directory for the served MLX 4-bit checkpoint.
target_dir() {
  repo_dir "${TARGET_REPO}"
}

# @function drafter_dir
# Local directory for the DFlash2 drafter.
drafter_dir() {
  repo_dir "${DRAFT_REPO}"
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

# @function is_ready
# Echo true when a directory holds at least MIN_GB.
is_ready() {
  local dir="$1" min="$2" size
  size=$(dir_size_gb "$dir")
  if awk "BEGIN {exit !($size >= $min)}"; then
    echo "true"
  else
    echo "false"
  fi
}

# @function cmd_status
# Print download readiness for the target checkpoint and the drafter.
cmd_status() {
  local tdir tsize tready ddir dsize dready
  tdir=$(target_dir)
  tsize=$(dir_size_gb "$tdir")
  tready=$(is_ready "$tdir" "${TARGET_MIN_GB}")
  ddir=$(drafter_dir)
  dsize=$(dir_size_gb "$ddir")
  dready=$(is_ready "$ddir" "${DRAFT_MIN_GB}")

  if [[ $JSON_FLAG == "--json" ]]; then
    printf '{"repo":"%s","path":"%s","size_gb":%s,"min_gb":%s,"ready":%s,"drafter_repo":"%s","drafter_path":"%s","drafter_min_gb":%s,"drafter_size_gb":%s,"drafter_ready":%s}\n' \
      "${TARGET_REPO}" "$tdir" "$tsize" "${TARGET_MIN_GB}" "$tready" \
      "${DRAFT_REPO}" "$ddir" "${DRAFT_MIN_GB}" "$dsize" "$dready"
  else
    log "model: ${TARGET_REPO} - ${tsize} GB at ${tdir} (min ${TARGET_MIN_GB} GB, ready=${tready})"
    log "drafter: ${DRAFT_REPO} - ${dsize} GB at ${ddir} (min ${DRAFT_MIN_GB} GB, ready=${dready})"
    log "Total ~19 GB; keep ~60 GB free on the Spark for the HF cache."
    log "Next: kubectl apply -k k8s/workloads/qwen3.8-27b-tensorfold (one Spark, spark0)."
  fi
}

# @function cmd_run
# Download the TensorFold checkpoint and drafter into MODELS_DIR.
cmd_run() {
  check_hf_cli
  mkdir -p "${MODELS_DIR}"
  log "Downloading ${TARGET_REPO} to $(target_dir)..."
  HF_HOME="${MODELS_DIR}" hf_download "${TARGET_REPO}" --local-dir "$(target_dir)"
  log "Downloading drafter ${DRAFT_REPO} to $(drafter_dir)..."
  HF_HOME="${MODELS_DIR}" hf_download "${DRAFT_REPO}" --local-dir "$(drafter_dir)"
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
