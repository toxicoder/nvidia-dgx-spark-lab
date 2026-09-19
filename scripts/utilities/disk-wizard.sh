#!/usr/bin/env bash
#
# ## disk-wizard
#
# Guided, plan-first reclaim for leftover files on a DGX Spark K3s node.
# Does not overload manage.sh cleanup (namespaces) or the dashboard treemap.
#
# Usage:
#   ./scripts/utilities/disk-wizard.sh status [--json]
#   ./scripts/utilities/disk-wizard.sh plan [--json] [--deep]
#   ./scripts/utilities/disk-wizard.sh recommend [--target-gib N] [--json]
#   ./scripts/utilities/disk-wizard.sh largest [--path DIR] [--n 30] [--json]
#   ./scripts/utilities/disk-wizard.sh explain PATH [--json]
#   ./scripts/utilities/disk-wizard.sh run [--json]
#   ./scripts/utilities/disk-wizard.sh apply --yes [--step A|B] [--id ID] [--path P]
#   ./scripts/utilities/disk-wizard.sh restore --from DIR
#
# Safety:
#   Default is plan/status (read-only). apply requires --yes.
#   Review-class items quarantine. Dangerous / keep-set / in-use refused.
#   run never deletes (dashboard contract).
#   Never runs docker system prune -a --volumes.
#   Does not weaken Resource Guard, restartPolicy, NCCL, or download utilities.
#
# @command disk-wizard

set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
SCRIPT_DIR="$(lab_script_dir 1 utilities)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck source=../lib/common.sh
source "${REPO_ROOT}/scripts/lib/common.sh"
# shellcheck source=../lib/disk_scan.sh
source "${REPO_ROOT}/scripts/lib/disk_scan.sh"

MODE="${MODE:-}"
YES=0
RESTORE_FROM=""
JSON_FLAG=0
FORCE=0
DEEP=0
STEP="A"
FILTER_ID=""
FILTER_PATH=""
TARGET_GIB=0
LARGEST_N=30
LARGEST_PATH=""
EXPLAIN_PATH=""
CONFIRM_TOKEN=""

# @function log
# Informational message on stderr (stdout stays JSON-clean).
log() { echo -e "[disk-wizard] $*" >&2; }
# @function warn
# Warning on stderr.
warn() { echo -e "[disk-wizard][WARN] $*" >&2; }
# @function err
# Error on stderr.
err() { echo -e "[disk-wizard][ERROR] $*" >&2; }

# @function disk_wizard_usage
# Print usage to stderr.
disk_wizard_usage() {
  echo "Usage: $0 status|plan|recommend|largest|explain|run|apply|restore [options]" >&2
  echo "No args on a TTY: interactive guide (still requires typing yes to apply)." >&2
  echo "Default without a TTY is plan. run never deletes. apply requires --yes." >&2
  echo "Time crunch: status  →  recommend --target-gib N  →  apply --yes" >&2
  echo "Never runs docker system prune -a --volumes." >&2
}

# @function parse_args
# Parse CLI into MODE / flags.
# Arguments:
#   $@
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "${1}" in
      status | plan | recommend | largest | explain | run | apply | restore | wizard)
        MODE="${1}"
        ;;
      --plan)
        MODE="plan"
        ;;
      --json)
        JSON_FLAG=1
        MODE="${MODE:-plan}"
        ;;
      --apply)
        MODE="apply"
        ;;
      --yes | -y) YES=1 ;;
      --force) FORCE=1 ;;
      --deep) DEEP=1 ;;
      --step)
        STEP="${2:?}"
        shift
        ;;
      --id)
        FILTER_ID="${2:?}"
        shift
        ;;
      --path)
        if [[ ${MODE} == "largest" ]]; then
          LARGEST_PATH="${2:?}"
        elif [[ ${MODE} == "explain" ]]; then
          EXPLAIN_PATH="${2:?}"
        else
          FILTER_PATH="${2:?}"
        fi
        shift
        ;;
      --from)
        RESTORE_FROM="${2:?}"
        shift
        ;;
      --target-gib)
        TARGET_GIB="${2:?}"
        shift
        ;;
      --n)
        LARGEST_N="${2:?}"
        shift
        ;;
      --confirm-token)
        CONFIRM_TOKEN="${2:?}"
        shift
        ;;
      -h | --help)
        disk_wizard_usage
        exit 0
        ;;
      *)
        if [[ ${MODE} == "explain" && -z ${EXPLAIN_PATH} ]]; then
          EXPLAIN_PATH="${1}"
        elif [[ ${MODE} == "restore" && -z ${RESTORE_FROM} ]]; then
          RESTORE_FROM="${1}"
        else
          err "Unknown arg: $1"
          disk_wizard_usage
          exit 1
        fi
        ;;
    esac
    shift
  done
}

# @function disk_is_tty
# True when stdin is a TTY.
disk_is_tty() {
  [[ -t 0 ]]
}

# @function disk_catalog_path
# Catalog YAML path.
disk_catalog_path() {
  echo "${REPO_ROOT}/config/disk-catalog.yaml"
}

# @function disk_plan_file
# Path to the last written plan JSON.
disk_plan_file() {
  if [[ -n ${MODELS_DIR:-} && -d ${MODELS_DIR} ]]; then
    echo "${MODELS_DIR}/.disk-wizard-plan.json"
    return 0
  fi
  echo "${DISK_WIZARD_HOME:-${HOME}}/.disk-wizard-plan.json"
}

# @function disk_log
# Append a UTC log line to MODELS_DIR wizard log and stderr.
# Arguments:
#   $@  message
disk_log() {
  local line dest
  line="$(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
  dest="${MODELS_DIR:-}/.disk-wizard.log"
  if [[ -n ${MODELS_DIR:-} && -d ${MODELS_DIR} ]]; then
    printf '%s\n' "${line}" >>"${dest}" 2>/dev/null || true
  fi
  log "$*"
}

# @function disk_catalog_py
# Run disk_catalog.py with the lab catalog.
# Arguments:
#   $@  subcommand and args
disk_catalog_py() {
  python3 "${REPO_ROOT}/scripts/lib/py/disk_catalog.py" --catalog "$(disk_catalog_path)" "$@"
}

# @function disk_survey_jsonl
# Walk (shallow or deep) plus docker/factory synthetic rows.
# Outputs:
#   JSONL on stdout
disk_survey_jsonl() {
  local root docker_blob
  local -a roots=()
  while IFS= read -r root; do
    [[ -z ${root} ]] && continue
    roots+=("${root}")
  done < <(disk_allowed_roots)
  if [[ ${#roots[@]} -gt 0 ]]; then
    if [[ ${DEEP} -eq 1 ]]; then
      disk_catalog_py walk --max-depth "${DISK_WIZARD_MAX_DEPTH:-8}" "${roots[@]}"
    else
      disk_catalog_py shallow "${roots[@]}"
    fi
  fi
  disk_factory_bittest_paths || true
  disk_crictl_image_rows || true
  log "Querying Docker / containerd disk usage (plan-only; never auto-pruned)…"
  docker_blob="$(disk_docker_df || true)"
  if [[ -n ${docker_blob} ]]; then
    python3 -c '
import json, os, sys
sys.path.insert(0, os.path.join(sys.argv[2], "scripts", "lib", "py"))
from disk_catalog import normalize_runtime_type
raw=sys.argv[1].strip()
if not raw:
    raise SystemExit(0)
for line in raw.splitlines():
    line=line.strip()
    if not line:
        continue
    try:
        obj=json.loads(line)
    except json.JSONDecodeError:
        continue
    dtype=str(obj.get("type") or obj.get("Type") or obj.get("docker_type") or "")
    ident=str(obj.get("id") or obj.get("ID") or obj.get("path") or dtype or "docker")
    try:
        size=int(obj.get("size_bytes") or obj.get("Size") or 0)
    except (TypeError, ValueError):
        size=0
    ntype=normalize_runtime_type(dtype or "build-cache")
    path="docker://"+ntype+"/"+ident
    print(json.dumps({"path": path, "size_bytes": size, "broken_symlink": False}))
' "${docker_blob}" "${REPO_ROOT}"
  fi
}

# @function disk_overlay_plan
# Apply in-use overlay to a ranked JSON array on stdin.
# Outputs:
#   JSON array
disk_overlay_plan() {
  local pods in_use
  disk_live_workload_flags || true
  pods="$(disk_kubectl_pods_json || true)"
  if [[ -n ${pods} ]]; then
    export LAB_MOCK_PODS_JSON="${pods}"
  fi
  in_use="$(disk_crictl_in_use || true)"
  if [[ -n ${in_use} ]]; then
    export LAB_MOCK_CRICTL_IN_USE="${in_use}"
  fi
  if disk_hf_pid_present; then
    export LAB_MOCK_HF_PID=1
  fi
  python3 "${REPO_ROOT}/scripts/lib/py/disk_inuse.py"
}

# @function disk_rank_and_overlay
# Classify JSONL on stdin, overlay, write plan file, print JSON array.
# Outputs:
#   ranked JSON
disk_rank_and_overlay() {
  local ranked dest
  ranked="$(disk_catalog_py rank)"
  ranked="$(printf '%s\n' "${ranked}" | disk_overlay_plan)"
  dest="$(disk_plan_file)"
  mkdir -p "$(dirname "${dest}")" 2>/dev/null || true
  printf '%s\n' "${ranked}" >"${dest}"
  printf '%s\n' "${ranked}"
}

# @function disk_print_plan
# Human A/B/C listing.
# Arguments:
#   $1  JSON array
disk_print_plan() {
  printf '%s\n' "${1}" | python3 -c '
import json, sys

rows = json.load(sys.stdin)

def gib(n):
    return "%.2f GiB" % (max(int(n or 0), 0) / 1024 / 1024 / 1024)

steps = {
    "A": "Step A — safe junk (default accept on apply --yes)",
    "B": "Step B — review leftovers (quarantine; default skip)",
    "C": "Step C — will not touch (keep-set, in-use, k3s, Engram)",
}
for step in ("A", "B", "C"):
    group = [r for r in rows if r.get("step") == step]
    print("")
    print(steps[step])
    if not group:
        print("  (none)")
        continue
    for r in group:
        size = gib(r.get("size_bytes") or 0)
        print("  [%s] %s  %s  %s" % (r.get("risk"), size, r.get("id"), r.get("path")))
        print("      what: %s" % (r.get("what") or ""))
        print("      why:  %s" % (r.get("why") or ""))
        edu = r.get("educate") or ""
        if edu:
            print("      note: %s" % edu)
        hint = r.get("redownload_hint") or ""
        if hint:
            print("      redownload: %s" % hint)
        if r.get("in_use"):
            print("      IN USE: %s" % "; ".join(r.get("in_use_reasons") or []))
        recency = r.get("recency_hint") or ""
        if recency:
            print("      recency: %s" % recency)
        print("      reclaim=%s" % (r.get("reclaim") or "none"))
totals = {"A": 0, "B": 0, "C": 0}
for r in rows:
    step = r.get("step")
    if step in totals:
        totals[step] += max(int(r.get("size_bytes") or 0), 0)
print("")
print("Reclaimable now (Step A):     %s" % gib(totals["A"]))
print("Review quarantine (Step B):   %s  (redownload can take hours)" % gib(totals["B"]))
print("Protected / will not touch:   %s" % gib(totals["C"]))
print("Time crunch: apply --yes for Step A, then largest, then --step B only if you still need space.")
'
}

# @function disk_survey
# Run survey + rank + overlay; print human or JSON.
disk_survey() {
  local ranked n
  log "Starting read-only disk survey (nothing is deleted)…"
  disk_df_report >&2 || true
  ranked="$(disk_survey_jsonl | disk_rank_and_overlay)"
  n="$(printf '%s\n' "${ranked}" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')"
  log "Plan written to $(disk_plan_file) (${n} items)"
  if [[ ${JSON_FLAG} -eq 1 ]]; then
    printf '%s\n' "${ranked}"
    return 0
  fi
  disk_print_plan "${ranked}"
}

# @function disk_status
# Fast df + roots + last-plan recommend. Never walks the NVMe (dashboard 8s).
disk_status() {
  local dfj roots_json rec dest
  dfj="$(disk_df_json)"
  roots_json="$(
    disk_allowed_roots | python3 -c '
import json, sys
out = [{"path": p.strip(), "measured": False} for p in sys.stdin if p.strip()]
print(json.dumps(out))
'
  )"
  dest="$(disk_plan_file)"
  rec="[]"
  if [[ -s ${dest} ]]; then
    rec="$(python3 -c '
import json,sys
sys.path.insert(0, sys.argv[1]+"/scripts/lib/py")
from disk_catalog import recommend_rows
rows=json.load(open(sys.argv[2]))
print(json.dumps(recommend_rows(rows, 0, include_review=True)[:8]))
' "${REPO_ROOT}" "${dest}")"
  fi
  python3 -c '
import json, sys
sys.path.insert(0, sys.argv[1]+"/scripts/lib/py")
from disk_catalog import pressure_for, format_gib
df = json.loads(sys.argv[2])
buckets = json.loads(sys.argv[3])
rec = json.loads(sys.argv[4])
as_json = sys.argv[5] == "1"
plan_path = sys.argv[6]
used_pct = float(df.get("used_pct") or 0)
avail = int(df.get("avail_bytes") or 0)
pressure = pressure_for(used_pct, avail)
payload = {
    "ok": True,
    "pressure": pressure,
    "used_pct": used_pct,
    "free_gib": round(avail / (1024**3), 2),
    "used_bytes": int(df.get("used_bytes") or 0),
    "avail_bytes": avail,
    "size_bytes": int(df.get("size_bytes") or 0),
    "buckets": buckets,
    "recommend": rec,
    "plan_path": plan_path,
    "apply": False,
    "note": "run never deletes; use apply --yes on the node. Never docker system prune -a --volumes. status does not walk NVMe (plan/recommend/largest do).",
}
if as_json:
    print(json.dumps(payload, sort_keys=True))
    raise SystemExit(0)
print("Disk wizard — this node  ·  %s used / %s  (%.0f%%  %s)" % (
    format_gib(payload["used_bytes"]), format_gib(payload["size_bytes"]), used_pct, pressure.upper()))
print("Nothing is deleted by status/run. apply --yes is required to reclaim.")
print("Spark NVMe (1 TB or 4 TB) is usually the same partition as /. One checkpoint is 100-500 GiB.")
print("")
print("Scan roots (sizes: run plan or largest — status stays fast for the dashboard):")
if not buckets:
    print("  (none — MODELS_DIR / caches missing on this host)")
for b in buckets:
    print("  %s" % (b.get("path"),))
print("")
if rec:
    print("From last plan (stale until you re-run plan):")
    for r in rec:
        flag = "review" if r.get("needs_confirm") else "safe"
        print("  [%s] %s  %s" % (flag, format_gib(int(r.get("size_bytes") or 0)), r.get("path")))
        if r.get("redownload_hint"):
            print("      WARNING: %s" % r.get("redownload_hint"))
    print("")
print("Time crunch: recommend --target-gib N   then   apply --yes")
print("NVMe is per-node. K3s images: sudo k3s crictl rmi --prune (manual, after plan).")
' "${REPO_ROOT}" "${dfj}" "${roots_json}" "${rec}" "${JSON_FLAG}" "$(disk_plan_file)"
}

# @function disk_recommend
# Time-crunch greedy list. Uses last plan or runs a shallow survey.
disk_recommend() {
  local dest ranked rec target
  dest="$(disk_plan_file)"
  if [[ ! -s ${dest} ]]; then
    log "No plan yet; running a shallow survey…"
    disk_survey_jsonl | disk_rank_and_overlay >/dev/null
    dest="$(disk_plan_file)"
  fi
  target="${TARGET_GIB}"
  rec="$(python3 -c '
import json,sys
sys.path.insert(0, sys.argv[1]+"/scripts/lib/py")
from disk_catalog import recommend_rows
rows=json.load(open(sys.argv[2]))
target=int(float(sys.argv[3]) * 1024 * 1024 * 1024)
print(json.dumps(recommend_rows(rows, target, include_review=True), sort_keys=True))
' "${REPO_ROOT}" "${dest}" "${target}")"
  if [[ ${JSON_FLAG} -eq 1 ]]; then
    printf '%s\n' "${rec}"
    return 0
  fi
  python3 -c '
import json,sys
rows=json.loads(sys.argv[1])
def gib(n):
    return "%.2f GiB" % (max(int(n or 0), 0) / 1024 / 1024 / 1024)
print("Time-crunch recommendations (safe first; review needs extra confirm):")
if not rows:
    print("  (none)")
    raise SystemExit(0)
for i, r in enumerate(rows, 1):
    flag = "review" if r.get("needs_confirm") else "safe"
    print("  %d. [%s] %s  %s  %s" % (i, flag, gib(r.get("size_bytes")), r.get("id"), r.get("path")))
    if r.get("redownload_hint"):
        print("      WARNING: %s" % r.get("redownload_hint"))
    if r.get("educate"):
        print("      %s" % r.get("educate"))
print("Apply safe junk: disk-wizard apply --yes")
print("Review leftovers quarantine only with: disk-wizard apply --yes --step B")
' "${rec}"
}

# @function disk_largest
# Top files and directories under an allowed root.
disk_largest() {
  local path
  path="${LARGEST_PATH:-${MODELS_DIR:-/mnt/models}}"
  disk_realpath_under_any "${path}" >/dev/null
  local out
  out="$(disk_catalog_py largest --path "${path}" --n "${LARGEST_N}")"
  if [[ ${JSON_FLAG} -eq 1 ]]; then
    printf '%s\n' "${out}"
    return 0
  fi
  python3 -c '
import json,sys
data=json.loads(sys.argv[1])
def gib(n):
    return "%.2f GiB" % (max(int(n or 0), 0) / 1024 / 1024 / 1024)
print("Largest directories:")
for r in data.get("dirs") or []:
    print("  %s  %s" % (gib(r.get("size_bytes")), r.get("path")))
print("Largest files:")
for r in data.get("files") or []:
    print("  %s  %s" % (gib(r.get("size_bytes")), r.get("path")))
' "${out}"
}

# @function disk_explain
# Classify one path and print education.
disk_explain() {
  local path row
  path="${EXPLAIN_PATH:?explain requires a path}"
  if [[ ${path} != docker://* && ${path} != crictl://* ]]; then
    disk_realpath_under_any "${path}" >/dev/null
  fi
  row="$(disk_catalog_py classify --path "${path}" --size 0)"
  row="$(printf '%s\n' "[${row}]" | disk_overlay_plan | python3 -c 'import json,sys; a=json.load(sys.stdin); print(json.dumps(a[0] if a else {}))')"
  if [[ ${JSON_FLAG} -eq 1 ]]; then
    printf '%s\n' "${row}"
    return 0
  fi
  python3 -c '
import json,sys
r=json.loads(sys.argv[1])
print("path:     %s" % r.get("path"))
print("class:    %s" % r.get("id"))
print("risk:     %s  step %s  reclaim=%s" % (r.get("risk"), r.get("step"), r.get("reclaim")))
print("what:     %s" % r.get("what"))
print("why:      %s" % r.get("why"))
print("educate:  %s" % (r.get("educate") or ""))
if r.get("redownload_hint"):
    print("redownload: %s" % r.get("redownload_hint"))
if r.get("recency_hint"):
    print("recency:  %s" % r.get("recency_hint"))
if r.get("in_use"):
    print("IN USE:   %s" % "; ".join(r.get("in_use_reasons") or []))
print("atime is not trusted (NVMe often noatime). Open fds and pod hostPath are.")
' "${row}"
}

# @function disk_resolve_apply_path
# Jail realpath, or OEM bittest exception. Refuses OS / k3s / models root / checkout.
# Arguments:
#   $1  path
# Outputs:
#   realpath
# Returns:
#   0 allowed; 1 refuse
disk_resolve_apply_path() {
  local target="${1}"
  local out rc=0
  out="$(python3 -c '
import os, sys
sys.path.insert(0, os.path.join(sys.argv[1], "scripts", "lib", "py"))
from disk_catalog import is_factory_bittest_path, is_protected_path
path, models, repo = sys.argv[2], sys.argv[3], sys.argv[4]
if is_protected_path(path, models_dir=models, repo_root=repo):
    raise SystemExit(2)
if is_factory_bittest_path(path):
    print(os.path.realpath(path))
    raise SystemExit(0)
raise SystemExit(1)
' "${REPO_ROOT}" "${target}" "${MODELS_DIR}" "${REPO_ROOT}")" || rc=$?
  if [[ ${rc} -eq 0 ]]; then
    printf '%s\n' "${out}"
    return 0
  fi
  if [[ ${rc} -eq 2 ]]; then
    err "protected path, refuse: ${target}"
    return 1
  fi
  disk_realpath_under_any "${target}"
}

# @function disk_apply_guards
# Refuse apply when hf pid unless --force.
disk_apply_guards() {
  if disk_hf_pid_present && [[ ${FORCE} -eq 0 ]]; then
    err "hf download appears to be running; refuse --apply (use --force to override)"
    return 1
  fi
  return 0
}

# @function disk_quarantine_base
# Quarantine destination directory for a path.
# Arguments:
#   $1  path
#   $2  utc stamp
disk_quarantine_base() {
  local path="${1}"
  local stamp="${2}"
  local models real
  models="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "${MODELS_DIR}")"
  real="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "${path}")"
  case "${real}/" in
    "${models}/"*)
      echo "${MODELS_DIR}/.disk-quarantine/${stamp}"
      return 0
      ;;
  esac
  echo "${DISK_WIZARD_HOME:-${HOME}}/.lab-disk-quarantine/${stamp}"
}

# @function disk_quarantine_one
# Move one path into quarantine with a manifest row.
# Arguments:
#   $1  class/id
#   $2  path
disk_quarantine_one() {
  local class="${1}"
  local path="${2}"
  local stamp dest real rel
  real="$(disk_resolve_apply_path "${path}")" || {
    log "skip ${class} ${path} (jail or protected)"
    return 0
  }
  if [[ ! -e ${real} && ! -L ${real} ]]; then
    log "already gone ${path}"
    return 0
  fi
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  dest="$(disk_quarantine_base "${real}" "${stamp}")"
  mkdir -p "${dest}"
  if ! python3 -c '
import os, sys
sys.path.insert(0, os.path.join(sys.argv[1], "scripts", "lib", "py"))
from disk_catalog import same_fs
raise SystemExit(0 if same_fs(sys.argv[2], sys.argv[3]) else 1)
' "${REPO_ROOT}" "${real}" "${dest}"; then
    err "quarantine dest is on a different filesystem (would copy); refuse ${path}"
    return 1
  fi
  rel="$(basename "${real}")"
  mv "${real}" "${dest}/${rel}"
  python3 -c '
import json,sys
print(json.dumps({"path": sys.argv[1], "class": sys.argv[2], "dest": sys.argv[3]}))
' "${real}" "${class}" "${dest}/${rel}" >>"${dest}/MANIFEST.jsonl"
  disk_log "quarantine ${class} ${path} -> ${dest}/${rel}"
}

# @function disk_delete_one
# Delete one junk path after jail + keep-set checks.
# Arguments:
#   $1  class
#   $2  path
disk_delete_one() {
  local class="${1}"
  local path="${2}"
  local real
  real="$(disk_resolve_apply_path "${path}")" || {
    log "skip ${class} ${path} (jail or protected)"
    return 0
  }
  if [[ ! -e ${real} && ! -L ${real} ]]; then
    log "already gone ${path}"
    return 0
  fi
  if [[ ${class} == keep-set-weight || ${class} == dsv41-engram || ${class} == k3s-server-data || ${class} == docker-local-volume ]]; then
    log "keep/dangerous class, skip ${path}"
    return 0
  fi
  if [[ -d ${real} && ! -L ${real} ]]; then
    rm -rf -- "${real}"
  else
    rm -f -- "${real}"
  fi
  disk_log "delete ${class} ${path}"
}

# @function disk_apply_one
# Apply one ranked row.
# Arguments:
#   $1  JSON object
disk_apply_one() {
  local row="${1}"
  local risk reclaim path id
  risk="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("risk",""))' "${row}")"
  reclaim="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("reclaim",""))' "${row}")"
  path="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("path",""))' "${row}")"
  id="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("id",""))' "${row}")"
  if [[ ${risk} == dangerous || ${reclaim} == none ]]; then
    log "skip ${id} ${path} (will not touch)"
    return 0
  fi
  if [[ ${path} == docker://* || ${path} == crictl://* ]]; then
    log "skip runtime object ${path} (plan-only; never docker system prune -a --volumes)"
    if [[ ${id} == containerd-unused-image ]]; then
      log "manual follow-up: sudo k3s crictl rmi --prune"
    fi
    return 0
  fi
  if [[ ${id} == factory-bittest && ${CONFIRM_TOKEN} != "BITTEST" ]]; then
    log "skip factory-bittest ${path} (pass --confirm-token BITTEST)"
    return 0
  fi
  case "${reclaim}" in
    delete)
      disk_delete_one "${id}" "${path}"
      ;;
    quarantine)
      disk_quarantine_one "${id}" "${path}"
      ;;
    docker-prune)
      log "skip docker-prune ${path} (not auto-applied)"
      ;;
    *)
      log "skip ${id} ${path}"
      ;;
  esac
}

# @function disk_apply
# Apply step A (safe) from the plan. Step B only with --step B.
disk_apply() {
  local dest row risk
  disk_apply_guards || return 1
  if [[ ${YES} -ne 1 ]]; then
    err "--apply requires --yes"
    return 1
  fi
  dest="$(disk_plan_file)"
  if [[ ! -s ${dest} ]]; then
    disk_survey >/dev/null
  fi
  dest="$(disk_plan_file)"
  python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "${dest}"
  while IFS= read -r row; do
    [[ -z ${row} ]] && continue
    if [[ -n ${FILTER_ID} ]]; then
      python3 -c 'import json,sys; raise SystemExit(0 if json.loads(sys.argv[1]).get("id")==sys.argv[2] else 1)' "${row}" "${FILTER_ID}" || continue
    fi
    if [[ -n ${FILTER_PATH} ]]; then
      python3 -c 'import json,sys; raise SystemExit(0 if json.loads(sys.argv[1]).get("path")==sys.argv[2] else 1)' "${row}" "${FILTER_PATH}" || continue
    fi
    risk="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("risk",""))' "${row}")"
    if [[ ${risk} == safe && ${STEP} == "A" ]]; then
      disk_apply_one "${row}"
      continue
    fi
    if [[ ${risk} == review && ${STEP} == "B" ]]; then
      disk_apply_one "${row}"
    fi
  done < <(python3 -c 'import json,sys
for r in json.load(open(sys.argv[1])):
    print(json.dumps(r))
' "${dest}")
}

# @function disk_restore
# Restore files from a quarantine tree using MANIFEST.jsonl.
disk_restore() {
  local src="${RESTORE_FROM}"
  [[ ${src} == /* ]] || src="${MODELS_DIR}/${src}"
  [[ -d ${src} ]] || {
    err "missing quarantine ${src}"
    return 1
  }
  local manifest="${src}/MANIFEST.jsonl"
  if [[ ! -f ${manifest} ]]; then
    err "missing ${manifest}"
    return 1
  fi
  disk_allowed_roots | python3 -c '
import json, os, sys
sys.path.insert(0, os.path.join(sys.argv[1], "scripts", "lib", "py"))
from disk_catalog import is_protected_path, path_under_roots
src = sys.argv[2]
models = sys.argv[3]
repo = sys.argv[4]
roots = [p.strip() for p in sys.stdin if p.strip()]
manifest = os.path.join(src, "MANIFEST.jsonl")
src_real = os.path.realpath(src)
for line in open(manifest, encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    row = json.loads(line)
    orig = row.get("path") or ""
    dest = row.get("dest") or ""
    if not orig or not dest or not os.path.exists(dest):
        print("skip missing %s" % dest, file=sys.stderr)
        continue
    dest_real = os.path.realpath(dest)
    if dest_real != src_real and not dest_real.startswith(src_real + os.sep):
        print("refuse dest outside quarantine %s" % dest, file=sys.stderr)
        raise SystemExit(1)
    if is_protected_path(orig, models_dir=models, repo_root=repo):
        print("refuse protected restore path %s" % orig, file=sys.stderr)
        raise SystemExit(1)
    if not path_under_roots(orig, roots):
        print("refuse restore outside allowed roots: %s" % orig, file=sys.stderr)
        raise SystemExit(1)
    os.makedirs(os.path.dirname(orig) or ".", exist_ok=True)
    if os.path.exists(orig):
        print("refuse overwrite %s" % orig, file=sys.stderr)
        raise SystemExit(1)
    os.rename(dest, orig)
    print("restore %s" % orig, file=sys.stderr)
' "${REPO_ROOT}" "${src}" "${MODELS_DIR}" "${REPO_ROOT}"
}

# @function disk_confirm_yes
# Require the operator to type yes (never a single keypress).
# Arguments:
#   $1  prompt
# Returns:
#   0 iff the line is exactly yes
disk_confirm_yes() {
  local ans=""
  echo "${1}" >&2
  echo "Type yes to continue (anything else aborts):" >&2
  read -r ans || return 1
  [[ ${ans} == "yes" ]]
}

# @function disk_wizard_menu
# Interactive TTY guide. Mutations still require typing yes.
disk_wizard_menu() {
  local choice planf
  JSON_FLAG=0
  disk_status
  echo >&2
  disk_recommend || true
  planf="$(disk_plan_file)"
  if [[ -s ${planf} ]]; then
    echo >&2
    disk_print_plan "$(cat "${planf}")"
  fi
  echo >&2
  echo "Nothing is deleted until you type yes. Dangerous / keep-set / in-use are refused." >&2
  while true; do
    echo "[s] status  [p] plan  [r] recommend  [l] largest  [e] explain" >&2
    echo "[a] apply Step A (safe junk)   [b] apply Step B (quarantine leftovers)" >&2
    echo "[q] quit" >&2
    printf 'Choice [q]: ' >&2
    choice=""
    read -r choice || break
    case "${choice}" in
      s | S) disk_status ;;
      p | P) disk_survey ;;
      r | R) disk_recommend ;;
      l | L) disk_largest ;;
      e | E)
        printf 'Path to explain: ' >&2
        EXPLAIN_PATH=""
        read -r EXPLAIN_PATH || continue
        if [[ -n ${EXPLAIN_PATH} ]]; then
          disk_explain
        fi
        ;;
      a | A | 1)
        if disk_confirm_yes "Delete Step A safe junk on this node (incomplete files, pip cache, dangling links)?"; then
          YES=1
          STEP="A"
          disk_apply
        else
          log "aborted Step A"
        fi
        ;;
      b | B | 2)
        if disk_confirm_yes "Quarantine Step B review leftovers? Re-download of hub repos can take hours."; then
          YES=1
          STEP="B"
          disk_apply
        else
          log "aborted Step B"
        fi
        ;;
      q | Q | "")
        break
        ;;
      *)
        echo "Unknown choice ${choice}" >&2
        ;;
    esac
  done
}

# @function main
# CLI dispatcher.
# Arguments:
#   $@
main() {
  parse_args "$@"
  MODELS_DIR="${MODELS_DIR:-/mnt/models}"
  export MODELS_DIR
  export REPO_ROOT
  if [[ -z ${MODE} ]]; then
    if disk_is_tty; then
      MODE="wizard"
    else
      MODE="plan"
    fi
  fi
  case "${MODE}" in
    status) disk_status ;;
    plan) disk_survey ;;
    recommend) disk_recommend ;;
    largest) disk_largest ;;
    explain) disk_explain ;;
    run)
      # Dashboard contract: never delete.
      JSON_FLAG=1
      disk_status
      ;;
    apply) disk_apply ;;
    restore) disk_restore ;;
    wizard) disk_wizard_menu ;;
    *)
      err "Unknown mode ${MODE}"
      disk_wizard_usage
      exit 1
      ;;
  esac
}

# Source guard: allows tests/libs to source without executing.
if [[ -z ${BASH_SOURCE[0]:-} || ${BASH_SOURCE[0]} == "${0}" ]]; then
  main "$@"
fi
