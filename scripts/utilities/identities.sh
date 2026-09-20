#!/usr/bin/env bash
#
# ## identities
#
# Plan-first automation for official lab users, groups, sudoers, and SSH keys.
# Replaces the factory ubuntu account as the day-2 Ansible principal.
#
# Usage:
#   ./scripts/utilities/identities.sh status [--json]
#   ./scripts/utilities/identities.sh plan
#   ./scripts/utilities/identities.sh run
#   ./scripts/utilities/identities.sh ensure-keys
#   ./scripts/utilities/identities.sh apply --yes
#   ./scripts/utilities/identities.sh ping
#
# Safety:
#   Default is status (read-only). apply requires --yes.
#   run never mutates (same as plan / --check).
#   Never prints private key material.
#   Never deletes the factory bootstrap user.
#   Never docker system prune -a --volumes.
#   Does not weaken Resource Guard, restartPolicy, or NCCL.
#
# @command identities

set -euo pipefail

# shellcheck source=../lib/paths.sh disable=SC1091
source "$(cd "$(dirname "${0}")" && pwd)/../lib/paths.sh"
SCRIPT_DIR="$(lab_script_dir 1 utilities)"
REPO_ROOT="${REPO_ROOT:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
# shellcheck source=../lib/common.sh
source "${REPO_ROOT}/scripts/lib/common.sh"

MODE="${MODE:-}"
YES=0
JSON_FLAG=0
HARDEN_SSH=0
HARDEN_BOOTSTRAP=0

# @function log
# Informational message on stderr (stdout stays JSON-clean).
log() { echo "[identities] $*" >&2; }
# @function warn
# Warning on stderr.
warn() { echo "[identities][WARN] $*" >&2; }
# @function err
# Error on stderr.
err() { echo "[identities][ERROR] $*" >&2; }

# @function identities_usage
# Print usage to stderr.
identities_usage() {
  echo "Usage: $0 status|plan|run|ensure-keys|apply|ping [options]" >&2
  echo "Default with no args: status. apply requires --yes." >&2
  echo "run never mutates (ansible --check). Never prints private keys." >&2
  echo "Never deletes the factory bootstrap user." >&2
}

# @function parse_args
# Parse CLI into MODE / flags.
# Arguments:
#   $@
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "${1}" in
      status | plan | run | ensure-keys | apply | ping | help | -h | --help)
        if [[ ${1} == "help" || ${1} == "-h" || ${1} == "--help" ]]; then
          identities_usage
          exit 0
        fi
        MODE="${1}"
        shift
        ;;
      --yes)
        YES=1
        shift
        ;;
      --json)
        JSON_FLAG=1
        shift
        ;;
      --harden-ssh)
        HARDEN_SSH=1
        shift
        ;;
      --harden-bootstrap-user)
        HARDEN_BOOTSTRAP=1
        shift
        ;;
      *)
        err "Unknown argument: ${1}"
        identities_usage
        exit 1
        ;;
    esac
  done
}

# @function identities_catalog_path
# Path to config/lab-identities.yaml.
# @stdout Absolute catalog path.
identities_catalog_path() {
  echo "${LAB_IDENTITIES_CATALOG:-${REPO_ROOT}/config/lab-identities.yaml}"
}

# @function identities_dir
# Gitignored SSH key directory on the operator client.
# @stdout Absolute directory path.
identities_dir() {
  echo "${LAB_IDENTITIES_DIR:-${REPO_ROOT}/secrets/identities}"
}

# @function identities_py
# Invoke lab_identities.py with the catalog path appended.
# Arguments:
#   $@  Subcommand and extra args for lab_identities.py.
identities_py() {
  local sub="${1:-}"
  if [[ $# -gt 0 ]]; then
    shift
  fi
  # Catalog immediately after the subcommand so Python 3.12 argparse does not
  # treat it as an unrecognized leftover after --identities-dir.
  python3 "${REPO_ROOT}/scripts/lib/py/lab_identities.py" "${sub}" "$(identities_catalog_path)" "$@"
}

# @function identities_topology_fact
# Read one key from lab.yaml facts (empty if topology is missing).
# Arguments:
#   $1  Fact key (ansible_user, bootstrap_user, ...).
# @stdout Fact value or empty.
identities_topology_fact() {
  local key="${1}"
  local lab_file facts
  lab_file="${REPO_ROOT}/ansible/inventory/lab.yaml"
  if [[ ! -f ${lab_file} ]]; then
    return 0
  fi
  facts="$(python3 "${REPO_ROOT}/scripts/lib/py/lab_topology.py" facts "${lab_file}" 2>/dev/null)" || return 0
  local kv
  for kv in ${facts}; do
    if [[ ${kv%%=*} == "${key}" ]]; then
      echo "${kv#*=}"
      return 0
    fi
  done
}

# @function identities_ansible_user
# Day-2 Ansible remote user (catalog / lab.yaml).
# @stdout Username.
identities_ansible_user() {
  local value
  value="$(identities_topology_fact ansible_user)"
  if [[ -n ${value} ]]; then
    echo "${value}"
    return 0
  fi
  python3 -c 'import json,sys; from pathlib import Path; sys.path.insert(0, "'"${REPO_ROOT}"'/scripts/lib/py"); from lab_identities import load_catalog, default_catalog_path; print(load_catalog(default_catalog_path())["ansible_user"])'
}

# @function identities_bootstrap_user
# Factory first-contact user used only by apply/plan.
# @stdout Username.
identities_bootstrap_user() {
  local value
  value="$(identities_topology_fact bootstrap_user)"
  if [[ -n ${value} ]]; then
    echo "${value}"
    return 0
  fi
  echo "ubuntu"
}

# @function identities_inventory
# Ansible inventory path (hosts.ini, else fail).
# @stdout Inventory path.
identities_inventory() {
  if [[ -n ${LAB_ANSIBLE_INVENTORY:-} ]]; then
    echo "${LAB_ANSIBLE_INVENTORY}"
    return 0
  fi
  if [[ -f ${REPO_ROOT}/ansible/inventory/hosts.ini ]]; then
    echo "${REPO_ROOT}/ansible/inventory/hosts.ini"
    return 0
  fi
  err "ansible/inventory/hosts.ini not found — run: bazelisk run //:manage -- setup"
  return 1
}

# @function identities_fingerprint
# OpenSSH SHA256 fingerprint of a public key file (never prints the key).
# Arguments:
#   $1  Path to .pub file.
# @stdout Fingerprint or "missing".
identities_fingerprint() {
  local pub="${1}"
  if [[ ! -f ${pub} ]]; then
    echo "missing"
    return 0
  fi
  local line
  line="$(ssh-keygen -l -E sha256 -f "${pub}" 2>/dev/null | awk '{print $2}')" || line=""
  if [[ -z ${line} ]]; then
    echo "present"
    return 0
  fi
  echo "${line}"
}

# @function cmd_status
# Catalog + local key presence. Never prints key material.
cmd_status() {
  local dir catalog
  dir="$(identities_dir)"
  catalog="$(identities_catalog_path)"
  if [[ ${JSON_FLAG} -eq 1 ]]; then
    identities_py status-json --identities-dir "${dir}"
    return 0
  fi
  log "=== Lab identities status ==="
  echo "Catalog: ${catalog}"
  echo "Key directory: ${dir}"
  echo "ansible_user: $(identities_ansible_user)"
  echo "bootstrap_user: $(identities_bootstrap_user)"
  echo "apply: false"
  echo "Never prints private keys. apply requires --yes. run never mutates."
  local user pub
  while IFS= read -r user; do
    [[ -z ${user} ]] && continue
    pub="${dir}/${user}.pub"
    echo "key ${user}: $(identities_fingerprint "${pub}")"
  done <<<"$(identities_py ssh-users)"
}

# @function identities_playbook_args
# Shared extra-vars for plan/apply.
# @stdout Arguments suitable for ansible-playbook.
identities_playbook_args() {
  local bootstrap dir
  bootstrap="$(identities_bootstrap_user)"
  dir="$(identities_dir)"
  echo -n "-e"
  echo -n " bootstrap_user=${bootstrap}"
  echo -n " -e"
  echo -n " ansible_user=${bootstrap}"
  echo -n " -e"
  echo -n " lab_identities_dir=${dir}"
  echo -n " -e"
  echo -n " harden_ssh=$([[ ${HARDEN_SSH} -eq 1 ]] && echo true || echo false)"
  echo -n " -e"
  echo -n " harden_bootstrap_user=$([[ ${HARDEN_BOOTSTRAP} -eq 1 ]] && echo true || echo false)"
  if [[ -n ${LAB_BOOTSTRAP_SSH_KEY:-} ]]; then
    echo -n " --private-key ${LAB_BOOTSTRAP_SSH_KEY}"
  fi
}

# @function cmd_plan
# ansible-playbook --check --diff as bootstrap_user. Never mutates.
cmd_plan() {
  local inv
  inv="$(identities_inventory)" || return 1
  if ! command -v ansible-playbook >/dev/null 2>&1; then
    err "ansible-playbook not found in PATH"
    return 1
  fi
  log "plan (check mode) inventory=${inv} user=$(identities_bootstrap_user)"
  # shellcheck disable=SC2046
  ANSIBLE_CONFIG="${REPO_ROOT}/ansible/ansible.cfg" \
    ansible-playbook -i "${inv}" \
    "${REPO_ROOT}/ansible/playbooks/configure-identities.yml" \
    --check --diff \
    $(identities_playbook_args)
}

# @function cmd_run
# Dashboard/status contract: never mutates. Same as plan.
cmd_run() {
  log "run never mutates (check mode)"
  cmd_plan
}

# @function cmd_ensure_keys
# Generate missing ed25519 pairs. Refuse to overwrite. Never prints keys.
cmd_ensure_keys() {
  local dir user priv
  dir="$(identities_dir)"
  mkdir -p "${dir}"
  chmod 0700 "${dir}"
  if ! command -v ssh-keygen >/dev/null 2>&1; then
    err "ssh-keygen not found in PATH"
    return 1
  fi
  while IFS= read -r user; do
    [[ -z ${user} ]] && continue
    priv="${dir}/${user}"
    if [[ -f ${priv} ]]; then
      log "key exists for ${user} (not overwritten)"
      chmod 0600 "${priv}" || true
      [[ -f ${priv}.pub ]] && chmod 0644 "${priv}.pub" || true
      continue
    fi
    ssh-keygen -t ed25519 -N "" -f "${priv}" -C "nvidia-dgx-spark-lab ${user}"
    chmod 0600 "${priv}"
    chmod 0644 "${priv}.pub"
    log "created key pair for ${user} (private key not printed)"
  done <<<"$(identities_py ssh-users)"
}

# @function cmd_apply
# Real playbook. Requires --yes. Never deletes the bootstrap user.
cmd_apply() {
  if [[ ${YES} -ne 1 ]]; then
    err "apply requires --yes"
    return 1
  fi
  local inv
  inv="$(identities_inventory)" || return 1
  if ! command -v ansible-playbook >/dev/null 2>&1; then
    err "ansible-playbook not found in PATH"
    return 1
  fi
  if [[ ${HARDEN_SSH} -eq 1 || ${HARDEN_BOOTSTRAP} -eq 1 ]]; then
    warn "hardening is opt-in and can lock SSH; OOB console is required"
  fi
  log "apply inventory=${inv} bootstrap_user=$(identities_bootstrap_user)"
  # shellcheck disable=SC2046
  ANSIBLE_CONFIG="${REPO_ROOT}/ansible/ansible.cfg" \
    ansible-playbook -i "${inv}" \
    "${REPO_ROOT}/ansible/playbooks/configure-identities.yml" \
    $(identities_playbook_args)
}

# @function cmd_ping
# ansible ping as the day-2 lab-ansible user with the identities private key.
cmd_ping() {
  local inv user key
  inv="$(identities_inventory)" || return 1
  user="$(identities_ansible_user)"
  key="$(identities_dir)/${user}"
  if [[ ! -f ${key} ]]; then
    err "missing ${key} — run: bazelisk run //:manage -- identities ensure-keys"
    return 1
  fi
  if ! command -v ansible >/dev/null 2>&1; then
    err "ansible not found in PATH"
    return 1
  fi
  log "ping user=${user} (private key not printed)"
  ANSIBLE_CONFIG="${REPO_ROOT}/ansible/ansible.cfg" \
    ansible -i "${inv}" k3s_cluster -m ping -u "${user}" --private-key "${key}"
}

# @function main
# Dispatch identities subcommands.
# Arguments:
#   $@
main() {
  parse_args "$@"
  export REPO_ROOT
  if [[ -z ${MODE} ]]; then
    MODE="status"
  fi
  case "${MODE}" in
    status) cmd_status ;;
    plan) cmd_plan ;;
    run) cmd_run ;;
    ensure-keys) cmd_ensure_keys ;;
    apply) cmd_apply ;;
    ping) cmd_ping ;;
    *)
      err "Unknown mode ${MODE}"
      identities_usage
      exit 1
      ;;
  esac
}

# Source guard: allows tests/libs to source without executing.
if [[ -z ${BASH_SOURCE[0]:-} || ${BASH_SOURCE[0]} == "${0}" ]]; then
  main "$@"
fi
