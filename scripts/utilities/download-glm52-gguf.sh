#!/usr/bin/env bash
#
# ## download-glm52-gguf
#
# Download unsloth/GLM-5.2-GGUF UD-IQ1_M shards (~228 GB) for the glm-5.2 llama.cpp RPC workload.
#
# **Intent**: Resumable, verified download of the 1-bit dynamic quant GGUF shards to shared model storage.
#
# **Idempotency**:
# - status reports shard count and on-disk size.
# - run only fetches missing shards (huggingface-cli resume).
#
# **Safety**:
# - Defaults to /mnt/models (same hostPath as inference jobs).
# - Does not delete existing shards.
# - Large download; run during off-peak.
#
# Usage:
#   ./scripts/utilities/download-glm52-gguf.sh status [--json]
#   ./scripts/utilities/download-glm52-gguf.sh run
#
# Dashboard can trigger download and show status.
#
# @command download-glm52-gguf
# @command glm52-download

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

HF_REPO=${HF_REPO:-"unsloth/GLM-5.2-GGUF"}
HF_INCLUDE=${HF_INCLUDE:-"UD-IQ1_M/*"}
MODELS_DIR=${MODELS_DIR:-"/mnt/models"}
SHARD_DIR="${MODELS_DIR}/GLM-5.2-GGUF/UD-IQ1_M"
EXPECTED_MIN_GB=${EXPECTED_MIN_GB:-200}

# @function check_hf_cli
# Fail if huggingface-cli or hf is not installed.

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
# Invoke huggingface-cli or hf download with given args.

hf_download() {
  if command -v huggingface-cli >/dev/null 2>&1; then
    huggingface-cli download "$@"
  else
    hf download "$@"
  fi
}

# @function count_shards
# Count GLM-5.2 UD-IQ1_M GGUF shard files on disk.

count_shards() {
  local n=0
  if [[ -d $SHARD_DIR ]]; then
    n=$(find "$SHARD_DIR" -maxdepth 1 -name 'GLM-5.2-UD-IQ1_M-*.gguf' 2>/dev/null | wc -l | tr -d ' ')
  fi
  echo "${n:-0}"
}

# @function first_shard
# Return path to first shard file if present.

first_shard() {
  find "$SHARD_DIR" -maxdepth 1 -name 'GLM-5.2-UD-IQ1_M-00001-of-*.gguf' 2>/dev/null | head -1 || true
}

# @function dir_size_human
# Human-readable size of shard directory.

dir_size_human() {
  if [[ -d $SHARD_DIR ]]; then
    du -sh "$SHARD_DIR" 2>/dev/null | cut -f1 || echo "0"
  else
    echo "0"
  fi
}

# @function dir_size_gb
# Integer GiB size of shard directory.

dir_size_gb() {
  if [[ -d $SHARD_DIR ]]; then
    du -sg "$SHARD_DIR" 2>/dev/null | cut -f1 || echo "0"
  else
    echo "0"
  fi
}

# @function status
# Report GLM-5.2 GGUF download status (text or --json).
# @param $1  Optional --json flag.

status() {
  local shards size_gb size_human first
  shards=$(count_shards)
  size_gb=$(dir_size_gb)
  size_human=$(dir_size_human)
  first=$(first_shard)

  if [[ ${1:-} == "--json" ]]; then
    cat <<JSON
{
  "repo": "${HF_REPO}",
  "shard_dir": "${SHARD_DIR}",
  "shard_count": ${shards},
  "size_gb": ${size_gb},
  "size_human": "${size_human}",
  "first_shard": "${first:-}",
  "ready": $([[ -n $first && $size_gb -ge $EXPECTED_MIN_GB ]] && echo "true" || echo "false")
}
JSON
    return
  fi

  echo "------------------------------------------------"
  echo "GLM-5.2 UD-IQ1_M GGUF Download Status"
  echo "------------------------------------------------"
  echo "Repo: ${HF_REPO}"
  echo "Shard dir: ${SHARD_DIR}"
  echo "Shards found: ${shards}"
  echo "On-disk size: ${size_human} (~${size_gb} GiB)"
  if [[ -n $first ]]; then
    echo "First shard: ${first}"
    echo "Ready for glm-5.2: yes (first shard present)"
  else
    echo "First shard: missing"
    echo "Ready for glm-5.2: no — run: $0 run"
  fi
  echo "------------------------------------------------"
}

# @function run
# Download GLM-5.2 GGUF shards from Hugging Face (resumable).

run() {
  check_hf_cli
  mkdir -p "$MODELS_DIR"
  log "Downloading ${HF_REPO} (${HF_INCLUDE}) to ${MODELS_DIR}..."
  log "This is ~228 GB; resumable if interrupted."
  hf_download "$HF_REPO" \
    --local-dir "$MODELS_DIR" \
    --include "$HF_INCLUDE" \
    --resume-download
  log "Download complete. Shards: $(count_shards), size: $(dir_size_human)"
  if [[ -z "$(first_shard)" ]]; then
    warn "First shard still missing after download. Check HF_INCLUDE and disk space."
    exit 1
  fi
}

case "${1:-}" in
  status)
    status "${2:-}"
    ;;
  run)
    run
    ;;
  *)
    echo "Usage: $0 {status [--json]|run}"
    exit 1
    ;;
esac
