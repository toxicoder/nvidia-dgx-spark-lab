#!/usr/bin/env bash
#
# ## download-qwen38-flash-next-tensorfold
#
# Download the single-DGX-Spark TensorFold checkpoint for Qwen3.8 Flash Next.
#
# Repos (about 96 GiB, plan for ~160 GB free disk on a fresh Spark, keep >= 100 GB):
#   nvidia/Qwen3.8-Flash-Next-FP4-Local   512-expert MoE, NVFP4 experts + MXFP8
#                                         attention/shared experts (~96 GiB) - served
#                                         model, pinned revision
#                                         b9ce18a6887e18c089fdea8509a33e63429a3300
#
# The snapshot lands under MODELS_DIR/<org>__<Model>, which is what the Job mounts at
# /models (MODEL_DIR=/models/nvidia__Qwen3.8-Flash-Next-FP4-Local, HF_HOME=/models).
# MTP drafts ship inside this checkpoint - there is no drafter repo to pull. The INT4
# alternative (azampatti/Qwen3.8-Flash-Next-125B-A5B-INT4-AutoRound) belongs to the
# db281878 recipe on upstream main, not this lane.
#
# The gated drowzeys Keys house-qsa abliteration overlay is optional and only fetched
# when HF_TOKEN is exported and the overlay's terms were accepted (lane default ABLIT
# off). Its exact HF repo id is not confirmed upstream, so override ABLIT_REPO once you
# have the accepted repo id. The whole repo is downloaded at the pinned revision; there
# is no --include filter, so budget the full 96 GiB.
#
# Usage:
#   bazelisk run //scripts:run-utility -- download-qwen38-flash-next-tensorfold status [--json]
#   bazelisk run //scripts:run-utility -- download-qwen38-flash-next-tensorfold run
#
# @command download-qwen38-flash-next-tensorfold

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
TARGET_REPO="nvidia/Qwen3.8-Flash-Next-FP4-Local"
TARGET_REVISION="b9ce18a6887e18c089fdea8509a33e63429a3300"
TARGET_MIN_GB=96
ABLIT_REPO=${ABLIT_REPO:-"drowzeys/keys-house-qsa-ablit"}

# @function repo_dir
# Local directory for a Hugging Face repo snapshot (org__name flattened with a double
# underscore so it matches the MODEL_DIR the Job mounts).
repo_dir() {
  local flat="${1//\//__}"
  echo "${MODELS_DIR}/${flat}"
}

# @function target_dir
# Local directory for the served NVFP4/MXFP8 checkpoint.
target_dir() {
  repo_dir "${TARGET_REPO}"
}

# @function ablit_dir
# Local directory for the optional gated abliteration overlay.
ablit_dir() {
  repo_dir "${ABLIT_REPO}"
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
# Invoke huggingface-cli download or hf download; extra args (--revision) pass through.
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

# @function download_ablit_overlay
# Fetch the gated abliteration overlay when HF_TOKEN is set; warn and skip otherwise.
download_ablit_overlay() {
  if [[ -z ${HF_TOKEN:-} ]]; then
    warn "HF_TOKEN not set: skipping gated ${ABLIT_REPO} (lane default ABLIT off)."
    return 0
  fi
  log "Downloading gated ${ABLIT_REPO} to $(ablit_dir)..."
  HF_HOME="${MODELS_DIR}" hf_download "${ABLIT_REPO}" --local-dir "$(ablit_dir)"
}

# @function cmd_status
# Print download readiness for the checkpoint and the optional gated overlay.
cmd_status() {
  local tdir tsize tready adir aready
  tdir=$(target_dir)
  tsize=$(dir_size_gb "$tdir")
  tready=$(is_ready "$tdir" "${TARGET_MIN_GB}")
  adir=$(ablit_dir)
  aready=false
  [[ -d $adir ]] && aready=true

  if [[ $JSON_FLAG == "--json" ]]; then
    printf '{"repo":"%s","revision":"%s","path":"%s","size_gb":%s,"min_gb":%s,"ready":%s,"ablit_repo":"%s","ablit_path":"%s","ablit_ready":%s,"hf_token":%s}\n' \
      "${TARGET_REPO}" "${TARGET_REVISION}" "$tdir" "$tsize" "${TARGET_MIN_GB}" "$tready" \
      "${ABLIT_REPO}" "$adir" "$aready" "$([[ -n ${HF_TOKEN:-} ]] && echo true || echo false)"
  else
    log "model: ${TARGET_REPO} @ ${TARGET_REVISION} - ${tsize} GB at ${tdir} (min ${TARGET_MIN_GB} GB, ready=${tready})"
    log "gated ablit: ${ABLIT_REPO} at ${adir} (present=${aready}; needs HF_TOKEN + accepted terms)"
    log "Full-repo download at the pinned revision (no --include filter); ~160 GB free disk fresh, keep >= 100 GB."
    log "MTP drafts ship in the checkpoint - no drafter repo to download."
    log "Next: kubectl apply -k k8s/workloads/qwen3.8-flash-next-tensorfold (one Spark, spark0)."
  fi
}

# @function cmd_run
# Download the pinned TensorFold checkpoint (and the gated overlay) into MODELS_DIR.
cmd_run() {
  check_hf_cli
  mkdir -p "${MODELS_DIR}"
  log "Downloading ${TARGET_REPO} @ ${TARGET_REVISION} to $(target_dir)..."
  HF_HOME="${MODELS_DIR}" hf_download "${TARGET_REPO}" \
    --revision "${TARGET_REVISION}" --local-dir "$(target_dir)"
  download_ablit_overlay
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
