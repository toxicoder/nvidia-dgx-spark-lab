#!/usr/bin/env bash
# ## disk_scan
#
# Read-only filesystem / containerd / docker survey helpers for disk-wizard.
# Source after common.sh. Not executable.
#
# Safety:
#   Does not delete. Realpath jail. Hermetic tests set LAB_HERMETIC=1 and
#   DISK_WIZARD_HOME so $HOME is never walked on a developer laptop.

# @function disk_scan_home
# Home used for ~/.cache and ~/.ollama (tests override DISK_WIZARD_HOME).
# Globals:
#   DISK_WIZARD_HOME, HOME
# Outputs:
#   Absolute home path
disk_scan_home() {
  printf '%s\n' "${DISK_WIZARD_HOME:-${HOME}}"
}

# @function disk_scan_hermetic
# True when this is a hermetic test run (no live docker/crictl/kubectl).
# Globals:
#   LAB_HERMETIC
# Returns:
#   0 hermetic
disk_scan_hermetic() {
  [[ ${LAB_HERMETIC:-0} == "1" ]]
}

# @function disk_allowed_roots
# Print allowed root directories (one per line), existing only.
# Globals:
#   MODELS_DIR, DISK_WIZARD_ROOTS, DISK_WIZARD_SCAN_TMP, DISK_WIZARD_HOME
# Outputs:
#   Paths on stdout
disk_allowed_roots() {
  local home root extra part
  root="${MODELS_DIR:-/mnt/models}"
  if [[ -d ${root} ]]; then
    python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "${root}"
  fi
  if [[ -n ${DISK_WIZARD_HOME:-} ]] || ! disk_scan_hermetic; then
    home="$(disk_scan_home)"
    for root in "${home}/.cache" "${home}/.ollama" "${home}/.triton" "${home}/.nv"; do
      if [[ -d ${root} ]]; then
        python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "${root}"
      fi
    done
  fi
  if [[ ${DISK_WIZARD_SCAN_TMP:-0} == "1" ]]; then
    for root in /tmp /var/tmp; do
      if [[ -d ${root} ]]; then
        python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "${root}"
      fi
    done
  elif ! disk_scan_hermetic && [[ -d /mnt/models ]]; then
    for root in /tmp /var/tmp; do
      if [[ -d ${root} ]]; then
        python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "${root}"
      fi
    done
  fi
  extra="${DISK_WIZARD_ROOTS:-}"
  if [[ -n ${extra} ]]; then
    local IFS=':'
    for part in ${extra}; do
      [[ -z ${part} ]] && continue
      if [[ -d ${part} ]]; then
        python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "${part}"
      fi
    done
  fi
}

# @function disk_root_is_allowed
# True if realpath(path) is under one of the allowed roots.
# Arguments:
#   $1  path
# Returns:
#   0 allowed
disk_root_is_allowed() {
  local target="${1}"
  local real root
  real="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "${target}")" || return 1
  while IFS= read -r root; do
    [[ -z ${root} ]] && continue
    case "${real}/" in
      "${root}/"*) return 0 ;;
    esac
    if [[ ${real} == "${root}" ]]; then
      return 0
    fi
  done < <(disk_allowed_roots)
  return 1
}

# @function disk_realpath_under_any
# Realpath; fail unless under an allowed root.
# Arguments:
#   $1  path
# Outputs:
#   realpath
# Returns:
#   0; 1 escape
disk_realpath_under_any() {
  local target="${1}"
  local real
  real="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "${target}")" || return 1
  if disk_root_is_allowed "${real}"; then
    printf '%s\n' "${real}"
    return 0
  fi
  err "path escapes disk-wizard roots: ${target}"
  return 1
}

# @function disk_df_json
# Filesystem size JSON for MODELS_DIR (or LAB_MOCK_DF_JSON).
# Globals:
#   MODELS_DIR, LAB_MOCK_DF_JSON
# Outputs:
#   JSON object
disk_df_json() {
  if [[ -n ${LAB_MOCK_DF_JSON:-} ]]; then
    if [[ -f ${LAB_MOCK_DF_JSON} ]]; then
      cat "${LAB_MOCK_DF_JSON}"
    else
      printf '%s\n' "${LAB_MOCK_DF_JSON}"
    fi
    return 0
  fi
  python3 -c '
import json, os, subprocess, sys
target = sys.argv[1]
try:
    out = subprocess.check_output(["df", "-Pk", target], text=True)
except Exception:
    print(json.dumps({"size_bytes": 0, "used_bytes": 0, "avail_bytes": 0, "used_pct": 0}))
    raise SystemExit(0)
lines = [ln for ln in out.splitlines() if ln.strip()]
if len(lines) < 2:
    print(json.dumps({"size_bytes": 0, "used_bytes": 0, "avail_bytes": 0, "used_pct": 0}))
    raise SystemExit(0)
parts = lines[-1].split()
# filesystem blocks used avail capacity mount
blocks = int(parts[1]) * 1024
used = int(parts[2]) * 1024
avail = int(parts[3]) * 1024
pct_s = parts[4].rstrip("%")
try:
    pct = float(pct_s)
except ValueError:
    pct = 0.0
print(json.dumps({"size_bytes": blocks, "used_bytes": used, "avail_bytes": avail, "used_pct": pct}))
' "${MODELS_DIR:-/}"
}

# @function disk_df_report
# Human df -h for MODELS_DIR (or mock).
# Globals:
#   MODELS_DIR, LAB_MOCK_DF
disk_df_report() {
  if [[ -n ${LAB_MOCK_DF:-} ]]; then
    printf '%s\n' "${LAB_MOCK_DF}"
    return 0
  fi
  df -h "${MODELS_DIR:-/}" 2>/dev/null || df -h /
}

# @function disk_docker_df
# Docker disk usage JSON lines (or LAB_MOCK_DOCKER_DF).
# Globals:
#   LAB_MOCK_DOCKER_DF, LAB_HERMETIC
disk_docker_df() {
  if [[ -n ${LAB_MOCK_DOCKER_DF:-} ]]; then
    if [[ -f ${LAB_MOCK_DOCKER_DF} ]]; then
      cat "${LAB_MOCK_DOCKER_DF}"
    else
      printf '%s\n' "${LAB_MOCK_DOCKER_DF}"
    fi
    return 0
  fi
  if disk_scan_hermetic; then
    return 0
  fi
  if command -v docker >/dev/null 2>&1; then
    docker system df --format '{{json .}}' 2>/dev/null || true
  fi
}

# @function disk_crictl_in_use
# Image ids in use (one per line).
# Globals:
#   LAB_MOCK_CRICTL_IN_USE, LAB_HERMETIC
disk_crictl_in_use() {
  if [[ -n ${LAB_MOCK_CRICTL_IN_USE:-} ]]; then
    if [[ -f ${LAB_MOCK_CRICTL_IN_USE} ]]; then
      cat "${LAB_MOCK_CRICTL_IN_USE}"
    else
      printf '%s\n' "${LAB_MOCK_CRICTL_IN_USE}"
    fi
    return 0
  fi
  if disk_scan_hermetic; then
    return 0
  fi
  if command -v k3s >/dev/null 2>&1; then
    k3s crictl ps -a --output json 2>/dev/null | python3 -c '
import json,sys
try:
    data=json.load(sys.stdin)
except Exception:
    raise SystemExit(0)
for c in data.get("containers") or []:
    img=c.get("image") or {}
    ident=img.get("image") or img.get("id") or ""
    if ident:
        print(ident)
' || true
  fi
}

# @function disk_hf_pid_present
# True if an hf download PID or pidfile is present.
# Globals:
#   MODELS_DIR, LAB_MOCK_HF_PID
# Returns:
#   0 running
disk_hf_pid_present() {
  if [[ ${LAB_MOCK_HF_PID:-0} == "1" ]]; then
    return 0
  fi
  if [[ -f ${MODELS_DIR:-/mnt/models}/.hf-download.pid ]]; then
    return 0
  fi
  if disk_scan_hermetic; then
    return 1
  fi
  if [[ -z ${REPO_ROOT:-} ]]; then
    return 1
  fi
  python3 -c '
import os, sys
sys.path.insert(0, os.path.join(sys.argv[1], "scripts", "lib", "py"))
from disk_inuse import hf_pid_present
raise SystemExit(0 if hf_pid_present() else 1)
' "${REPO_ROOT}"
}

# @function disk_factory_bittest_paths
# Non-recursive *bittest* glob under DISK_WIZARD_ROOT_GLOB_BASE (default /).
# Hermetic runs skip unless DISK_WIZARD_ROOT_GLOB_BASE is set.
# Outputs:
#   JSONL path/size rows
disk_factory_bittest_paths() {
  local base f
  if disk_scan_hermetic && [[ -z ${DISK_WIZARD_ROOT_GLOB_BASE:-} ]]; then
    return 0
  fi
  base="${DISK_WIZARD_ROOT_GLOB_BASE:-/}"
  [[ -d ${base} ]] || return 0
  for f in "${base}"/*bittest* "${base}"/~bittest*; do
    [[ -e ${f} || -L ${f} ]] || continue
    python3 -c '
import json, os, sys
p = sys.argv[1]
size = 0
try:
    if os.path.isdir(p) and not os.path.islink(p):
        for root, dirs, files in os.walk(p, followlinks=False):
            for name in files:
                fp = os.path.join(root, name)
                try:
                    size += os.path.getsize(fp)
                except OSError:
                    pass
    else:
        size = os.path.getsize(p)
except OSError:
    size = 0
print(json.dumps({"path": os.path.realpath(p), "size_bytes": int(size), "broken_symlink": False}))
' "${f}"
  done
}

# @function disk_crictl_image_rows
# containerd image JSONL (crictl://unused-image/ID or in-use). Hermetic unless mocked.
# Globals:
#   LAB_MOCK_CRICTL_IMAGES, LAB_HERMETIC
# Outputs:
#   JSONL path/size rows
disk_crictl_image_rows() {
  if [[ -n ${LAB_MOCK_CRICTL_IMAGES:-} ]]; then
    if [[ -f ${LAB_MOCK_CRICTL_IMAGES} ]]; then
      cat "${LAB_MOCK_CRICTL_IMAGES}"
    else
      printf '%s\n' "${LAB_MOCK_CRICTL_IMAGES}"
    fi
    return 0
  fi
  if disk_scan_hermetic; then
    return 0
  fi
  if ! command -v k3s >/dev/null 2>&1 && ! command -v crictl >/dev/null 2>&1; then
    return 0
  fi
  local blob in_use
  in_use="$(disk_crictl_in_use || true)"
  if command -v k3s >/dev/null 2>&1; then
    blob="$(k3s crictl images -o json 2>/dev/null || true)"
  else
    blob="$(crictl images -o json 2>/dev/null || true)"
  fi
  [[ -n ${blob} ]] || return 0
  python3 -c '
import json, sys
raw = sys.argv[1]
in_use = set(x.strip() for x in sys.argv[2].splitlines() if x.strip())
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    raise SystemExit(0)
images = data.get("images") if isinstance(data, dict) else data
if not isinstance(images, list):
    raise SystemExit(0)
for img in images:
    if not isinstance(img, dict):
        continue
    ident = str(img.get("id") or img.get("Id") or "")
    if not ident:
        continue
    size = img.get("size") or img.get("Size") or 0
    try:
        size_i = int(size)
    except (TypeError, ValueError):
        size_i = 0
    used = ident in in_use or any(ident in x or x in ident for x in in_use)
    kind = "in-use-image" if used else "unused-image"
    print(json.dumps({"path": "crictl://%s/%s" % (kind, ident), "size_bytes": size_i, "broken_symlink": False}))
' "${blob}" "${in_use}"
}

# @function disk_live_workload_flags
# Set LAB_MOCK_VISUAL / MODE_C / FLASH_NEXT from live kubectl (no-op when hermetic).
# Globals:
#   LAB_HERMETIC, LAB_MOCK_VISUAL, LAB_MOCK_MODE_C, LAB_MOCK_FLASH_NEXT
disk_live_workload_flags() {
  if disk_scan_hermetic; then
    return 0
  fi
  if ! command -v kubectl >/dev/null 2>&1; then
    return 0
  fi
  if kubectl get deploy,sts -A -l workload=visual --no-headers 2>/dev/null | grep -q .; then
    export LAB_MOCK_VISUAL=1
  fi
  local pods
  pods="$(kubectl get pods -A --no-headers 2>/dev/null || true)"
  if [[ -n ${pods} ]]; then
    if grep -q 'deepseek-v4.1-flash' <<<"${pods}"; then
      export LAB_MOCK_MODE_C=1
    fi
    if grep -q 'qwen3.8-flash-next' <<<"${pods}"; then
      export LAB_MOCK_FLASH_NEXT=1
    fi
  fi
  return 0
}

# @function disk_kubectl_pods_json
# kubectl get pods -A -o json or LAB_MOCK_PODS_JSON.
# Globals:
#   LAB_MOCK_PODS_JSON, LAB_HERMETIC
disk_kubectl_pods_json() {
  if [[ -n ${LAB_MOCK_PODS_JSON:-} ]]; then
    if [[ -f ${LAB_MOCK_PODS_JSON} ]]; then
      cat "${LAB_MOCK_PODS_JSON}"
    else
      printf '%s\n' "${LAB_MOCK_PODS_JSON}"
    fi
    return 0
  fi
  if disk_scan_hermetic; then
    echo '{"items":[]}'
    return 0
  fi
  if command -v kubectl >/dev/null 2>&1; then
    kubectl get pods -A -o json 2>/dev/null || echo '{"items":[]}'
  else
    echo '{"items":[]}'
  fi
}
