#!/usr/bin/env bash
#
# ## download-qwen38-27b-exl3
#
# Download a Qwen3.8-27B EXL3 quant for the 16 GB+ consumer-GPU ExLlamaV3 lane.
#
# Tiers (EXL3 bits-per-weight; each quant is roughly 9.7-22.9 GB on disk):
#   2.0bpw   Mia-AiLab/Qwen3.8-27B-EXL3-2.0bpw      12 GB cards (default branch)
#   2.5bpw   turboderp/Qwen3.8-27B-exl3             16 GB cards, roomy
#   3.0bpw   turboderp/Qwen3.8-27B-exl3             16 GB cards (default)
#   3.5bpw   turboderp/Qwen3.8-27B-exl3             16-24 GB cards
#   4.0bpw   turboderp/Qwen3.8-27B-exl3             24 GB+ cards
#   6.0bpw   turboderp/Qwen3.8-27B-exl3             32 GB+ cards
#
# The turboderp repo publishes one quant per revision, so --tier doubles as the
# revision. Snapshots land under MODELS_DIR/<org>__<Model>/<tier> so the Job's
# MODEL_DIR can select a quant without a second download.
#
# --drafter also pulls r0b0tlab/Qwen3.8-27B-DFlash2-EXL3-4.00bpw (~1.25 GB).
# Plan for ~10-24 GB per quant plus the drafter.
#
# Usage:
#   bazelisk run //scripts:run-utility -- download-qwen38-27b-exl3 status [--tier 3.0bpw] [--json]
#   bazelisk run //scripts:run-utility -- download-qwen38-27b-exl3 run [--tier 3.0bpw] [--drafter]
#
# @command download-qwen38-27b-exl3

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
TIER="3.0bpw"
JSON_FLAG=""
WITH_DRAFTER="false"
CMD="status"
DRAFT_REPO="r0b0tlab/Qwen3.8-27B-DFlash2-EXL3-4.00bpw"

# @function tier_repo
# Hugging Face repo id for a bpw tier ("" when unknown).
tier_repo() {
  case "$1" in
    2.0bpw) echo "Mia-AiLab/Qwen3.8-27B-EXL3-2.0bpw" ;;
    2.5bpw | 3.0bpw | 3.5bpw | 4.0bpw | 6.0bpw) echo "turboderp/Qwen3.8-27B-exl3" ;;
    *) echo "" ;;
  esac
}

# @function tier_revision
# Revision for a tier; the turboderp repo ships one quant per revision, the
# Mia-AiLab 2.0 bpw repo has a single default snapshot.
tier_revision() {
  case "$1" in
    2.0bpw) echo "" ;;
    2.5bpw | 3.0bpw | 3.5bpw | 4.0bpw | 6.0bpw) echo "$1" ;;
    *) echo "" ;;
  esac
}

# @function tier_min_gb
# Minimum on-disk GB required to call a tier ready.
tier_min_gb() {
  case "$1" in
    2.0bpw) echo 9 ;;
    2.5bpw) echo 11 ;;
    3.0bpw) echo 13 ;;
    3.5bpw) echo 15 ;;
    4.0bpw) echo 17 ;;
    6.0bpw) echo 22 ;;
    *) echo 0 ;;
  esac
}

# @function repo_root_dir
# Local snapshot root for a Hugging Face repo id (org__name flattened with a double
# underscore so it matches the MODEL_DIR the Job mounts).
repo_root_dir() {
  local flat="${1//\//__}"
  echo "${MODELS_DIR}/${flat}"
}

# @function tier_dir
# Local directory for a tier's snapshot: <repo root>/<tier>.
tier_dir() {
  local repo
  repo=$(tier_repo "$1")
  echo "$(repo_root_dir "${repo}")/$1"
}

# @function drafter_dir
# Local directory for the DFlash2 EXL3 drafter.
drafter_dir() {
  repo_root_dir "${DRAFT_REPO}"
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

# @function download_snapshot
# Download one repo snapshot into a local dir, pinned to a revision when set.
download_snapshot() {
  local repo="$1" dir="$2" revision="${3:-}"
  local -a args=("$repo" --local-dir "$dir")
  if [[ -n $revision ]]; then
    args+=(--revision "$revision")
  fi
  mkdir -p "$dir"
  HF_HOME="${MODELS_DIR}" hf_download "${args[@]}"
}

# @function validate_tier
# Fail fast on an unknown tier id.
validate_tier() {
  if [[ -z $(tier_repo "${TIER}") ]]; then
    err "Unknown tier: ${TIER} (use 2.0bpw|2.5bpw|3.0bpw|3.5bpw|4.0bpw|6.0bpw)"
    exit 1
  fi
}

# @function cmd_status
# Print download readiness for the selected tier and the drafter.
cmd_status() {
  validate_tier
  local repo revision dir min size ready ddir dsize dready
  repo=$(tier_repo "${TIER}")
  revision=$(tier_revision "${TIER}")
  dir=$(tier_dir "${TIER}")
  min=$(tier_min_gb "${TIER}")
  size=$(dir_size_gb "$dir")
  ready=$(is_ready "$dir" "$min")
  ddir=$(drafter_dir)
  dsize=$(dir_size_gb "$ddir")
  dready=$(is_ready "$ddir" 1)

  if [[ $JSON_FLAG == "--json" ]]; then
    printf '{"tier":"%s","repo":"%s","revision":"%s","path":"%s","size_gb":%s,"min_gb":%s,"ready":%s,"drafter_repo":"%s","drafter_path":"%s","drafter_size_gb":%s,"drafter_ready":%s}\n' \
      "${TIER}" "$repo" "$revision" "$dir" "$size" "$min" "$ready" \
      "${DRAFT_REPO}" "$ddir" "$dsize" "$dready"
  else
    log "tier: ${TIER} - ${repo}${revision:+ (revision ${revision})}"
    log "path: ${dir} - ${size} GB (min ${min} GB, ready=${ready})"
    log "drafter: ${DRAFT_REPO} - ${dsize} GB at ${ddir} (ready=${dready})"
    log "Disk: 9.7-22.9 GB per quant plus ~1.25 GB for the drafter."
    log "Next: kubectl apply -k k8s/workloads/qwen3.8-27b-exl3-16gb (MODEL_DIR points here)."
  fi
}

# @function cmd_run
# Download the selected tier (and drafter with --drafter) into MODELS_DIR.
cmd_run() {
  validate_tier
  check_hf_cli
  mkdir -p "${MODELS_DIR}"
  local repo revision
  repo=$(tier_repo "${TIER}")
  revision=$(tier_revision "${TIER}")
  log "Downloading ${repo} (tier: ${TIER}) to $(tier_dir "${TIER}")..."
  download_snapshot "$repo" "$(tier_dir "${TIER}")" "$revision"
  if [[ $WITH_DRAFTER == "true" ]]; then
    log "Downloading drafter ${DRAFT_REPO}..."
    download_snapshot "${DRAFT_REPO}" "$(drafter_dir)"
  fi
  cmd_status
}

# @function main
# CLI entry: status|run [--tier <bpw>] [--drafter] [--json].
main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json) JSON_FLAG="--json" ;;
      --drafter) WITH_DRAFTER="true" ;;
      --tier)
        TIER="${2:?--tier needs a value}"
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
  case "$CMD" in
    status) cmd_status ;;
    run) cmd_run ;;
    *)
      err "Usage: $0 status|run [--tier 2.0bpw|2.5bpw|3.0bpw|3.5bpw|4.0bpw|6.0bpw] [--drafter] [--json]"
      exit 1
      ;;
  esac
}

if [[ ${BASH_SOURCE[0]} == "${0}" ]]; then
  main "$@"
fi
