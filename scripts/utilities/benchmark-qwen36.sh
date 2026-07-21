#!/usr/bin/env bash
#
# ## benchmark-qwen36
#
# Simple OpenAI-compatible latency/throughput smoke bench for Qwen3.6 endpoints.
# Hermetic-friendly defaults use localhost port-forwards; no cluster required for --dry-run.
#
# Usage:
#   ./scripts/utilities/benchmark-qwen36.sh run --model 27b [--concurrency 1,4]
#   ./scripts/utilities/benchmark-qwen36.sh run --dual --concurrency 4
#   ./scripts/utilities/benchmark-qwen36.sh run --dry-run
#
# @command benchmark-qwen36

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

CMD="run"
MODEL="27b"
DUAL=0
CONCURRENCY="1"
DRY_RUN=0
BASE_27B="${BASE_27B:-http://127.0.0.1:8001/v1}"
BASE_35B="${BASE_35B:-http://127.0.0.1:8002/v1}"
PROMPT="${BENCH_PROMPT:-Write a short Python function that reverses a string.}"
MAX_TOKENS="${BENCH_MAX_TOKENS:-128}"

# @function parse_args
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      run | status) CMD="$1" ;;
      --model)
        MODEL="${2:?}"
        shift
        ;;
      --dual) DUAL=1 ;;
      --concurrency)
        CONCURRENCY="${2:?}"
        shift
        ;;
      --dry-run) DRY_RUN=1 ;;
      --base-27b)
        BASE_27B="${2:?}"
        shift
        ;;
      --base-35b)
        BASE_35B="${2:?}"
        shift
        ;;
      *)
        err "Unknown arg: $1"
        exit 1
        ;;
    esac
    shift
  done
}

# @function endpoint_for_model
endpoint_for_model() {
  case "$1" in
    27b | qwen3.6-27b-nvfp4) echo "$BASE_27B" ;;
    35b | 35b-a3b | qwen3.6-35b-a3b-nvfp4) echo "$BASE_35B" ;;
    *) echo "" ;;
  esac
}

# @function model_id_for
model_id_for() {
  case "$1" in
    27b | qwen3.6-27b-nvfp4) echo "unsloth/Qwen3.6-27B-NVFP4" ;;
    35b | 35b-a3b | qwen3.6-35b-a3b-nvfp4) echo "unsloth/Qwen3.6-35B-A3B-NVFP4-Fast" ;;
    *) echo "" ;;
  esac
}

# @function one_request
# Single chat completion; prints duration_ms and usage if available.
one_request() {
  local base="$1"
  local model_id="$2"
  local start end ms
  start=$(date +%s%N)
  if ! curl -sf --max-time 300 "${base}/chat/completions" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"${model_id}\",\"messages\":[{\"role\":\"user\",\"content\":$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$PROMPT")}],\"max_tokens\":${MAX_TOKENS},\"temperature\":0.6}" \
    -o /tmp/qwen36-bench-$$.json; then
    err "Request failed against ${base}"
    return 1
  fi
  end=$(date +%s%N)
  ms=$(((end - start) / 1000000))
  local completion_tokens
  completion_tokens=$(python3 -c "import json; d=json.load(open('/tmp/qwen36-bench-$$.json')); print(d.get('usage',{}).get('completion_tokens',0))" 2>/dev/null || echo 0)
  local tps="n/a"
  if [[ $completion_tokens =~ ^[0-9]+$ && $completion_tokens -gt 0 && $ms -gt 0 ]]; then
    tps=$(python3 -c "print(round($completion_tokens / ($ms/1000.0), 2))")
  fi
  echo "ok ms=${ms} completion_tokens=${completion_tokens} tok_s≈${tps} model=${model_id}"
}

# @function bench_model
bench_model() {
  local key="$1"
  local conc="$2"
  local base model_id i
  base=$(endpoint_for_model "$key")
  model_id=$(model_id_for "$key")
  if [[ -z $base || -z $model_id ]]; then
    err "Unknown model key: $key"
    return 1
  fi
  log "=== Bench ${key} base=${base} concurrency=${conc} ==="
  if [[ $DRY_RUN -eq 1 ]]; then
    log "[dry-run] would POST ${conc}× chat/completions to ${base} model=${model_id}"
    return 0
  fi
  if ! curl -sf --max-time 10 "${base}/models" >/dev/null; then
    err "Endpoint not ready: ${base}/models (port-forward services first)"
    return 1
  fi
  for ((i = 1; i <= conc; i++)); do
    one_request "$base" "$model_id" &
  done
  wait
}

# @function cmd_run
cmd_run() {
  local c
  IFS=',' read -r -a concs <<<"$CONCURRENCY"
  if [[ $DUAL -eq 1 ]]; then
    for c in "${concs[@]}"; do
      bench_model "27b" "$c"
      bench_model "35b" "$c"
    done
  else
    for c in "${concs[@]}"; do
      bench_model "$MODEL" "$c"
    done
  fi
  log "Done. For agentic coding evals, point SWE-bench / custom harness at the OpenAI base_url above."
}

parse_args "$@"
case "$CMD" in
  run) cmd_run ;;
  *)
    err "Usage: $0 run [--model 27b|35b] [--dual] [--concurrency 1,4] [--dry-run]"
    exit 1
    ;;
esac
