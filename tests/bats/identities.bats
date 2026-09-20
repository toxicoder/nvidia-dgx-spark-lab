#!/usr/bin/env bats
#
# Hermetic tests for scripts/utilities/identities.sh (plan-first, no live SSH).

load 'test_helper'

setup_file() {
  TEST_TMP_DIR="$(mktemp -d)"
  export TEST_TMP_DIR
  export REPO_ROOT="$(bats_canonical_repo_root)"
  export LAB_HERMETIC=1
  export LAB_IDENTITIES_DIR="${TEST_TMP_DIR}/secrets/identities"
  export LAB_ANSIBLE_INVENTORY="${TEST_TMP_DIR}/hosts.ini"
  mkdir -p "${LAB_IDENTITIES_DIR}" "${TEST_TMP_DIR}/bin"
  cat >"${LAB_ANSIBLE_INVENTORY}" <<'INI'
[k3s_cluster]
spark0 ansible_host=127.0.0.1 ansible_user=lab-ansible
[k3s_server]
spark0
INI
  export PATH="${TEST_TMP_DIR}/bin:${PATH}"
}

setup() {
  export TEST_TMP_DIR REPO_ROOT LAB_IDENTITIES_DIR LAB_ANSIBLE_INVENTORY PATH
  mkdir -p "${LAB_IDENTITIES_DIR}" "${TEST_TMP_DIR}/bin"
  : >"${TEST_TMP_DIR}/ansible-playbook.args"
  cat >"${TEST_TMP_DIR}/bin/ssh-keygen" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
out=""
fingerprint_only=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -l) fingerprint_only=1; shift ;;
    -E) shift 2 ;;
    -f)
      out="$2"
      shift 2
      ;;
    -t | -N | -C) shift 2 ;;
    *) shift ;;
  esac
done
if [[ $fingerprint_only -eq 1 ]]; then
  echo "256 SHA256:TESTFINGERPRINT comment (ED25519)"
  exit 0
fi
if [[ -z ${out} ]]; then
  exit 1
fi
printf 'fake-private-key\n' >"${out}"
printf 'ssh-ed25519 AAAAC3NzaCFAKE comment\n' >"${out}.pub"
chmod 600 "${out}"
chmod 644 "${out}.pub"
MOCK
  chmod +x "${TEST_TMP_DIR}/bin/ssh-keygen"
  : >"${TEST_TMP_DIR}/ansible-playbook.args"
  cat >"${TEST_TMP_DIR}/bin/ansible-playbook" <<MOCK
#!/usr/bin/env bash
printf '%s\n' "\$@" >"${TEST_TMP_DIR}/ansible-playbook.args"
echo "MOCK ansible-playbook \$*"
exit 0
MOCK
  chmod +x "${TEST_TMP_DIR}/bin/ansible-playbook"
  cat >"${TEST_TMP_DIR}/bin/ansible" <<'MOCK'
#!/usr/bin/env bash
echo "MOCK ansible $*"
echo "spark0 | SUCCESS => {\"ping\": \"pong\"}"
exit 0
MOCK
  chmod +x "${TEST_TMP_DIR}/bin/ansible"
}

teardown_file() {
  rm -rf "$TEST_TMP_DIR" || true
}

ident() {
  bash "${REPO_ROOT}/scripts/utilities/identities.sh" "$@"
}

@test "gitignore blocks secrets/identities key material" {
  grep -q 'secrets/identities/\*\*' "${REPO_ROOT}/.gitignore"
  grep -q '!secrets/identities/README.md' "${REPO_ROOT}/.gitignore"
  [[ -f ${REPO_ROOT}/secrets/identities/README.md ]]
}

@test "identities is not a dashboard allow-listed utility" {
  ! grep -q '"identities"' "${REPO_ROOT}/dashboard/lib/allowed-utilities.ts"
}

@test "help mentions apply --yes and never prints private keys" {
  run ident --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"apply requires --yes"* ]]
  [[ "$output" == *"Never prints private keys"* ]]
  [[ "$output" == *"run never mutates"* ]]
}

@test "status --json has ansible_user and no private key armor" {
  run ident status --json
  if [[ $status -ne 0 ]]; then
    echo "$output" >&2
  fi
  [ "$status" -eq 0 ]
  [[ "$output" == *"lab-ansible"* ]]
  [[ "$output" != *"BEGIN OPENSSH"* ]]
  [[ "$output" != *"fake-private"* ]]
}

@test "status does not print BEGIN or key bytes" {
  run ident status
  [ "$status" -eq 0 ]
  [[ "$output" == *"apply: false"* ]]
  [[ "$output" != *"BEGIN OPENSSH"* ]]
  [[ "$output" != *"PRIVATE KEY"* ]]
}

@test "apply without --yes fails and does not invoke ansible-playbook" {
  run ident apply
  [ "$status" -ne 0 ]
  [[ "$output" == *"apply requires --yes"* ]]
  [[ ! -s ${TEST_TMP_DIR}/ansible-playbook.args ]]
}

@test "run never mutates and passes --check" {
  run ident run
  [ "$status" -eq 0 ]
  grep -q -- '--check' "${TEST_TMP_DIR}/ansible-playbook.args"
}

@test "plan passes --check --diff" {
  run ident plan
  [ "$status" -eq 0 ]
  grep -q -- '--check' "${TEST_TMP_DIR}/ansible-playbook.args"
  grep -q -- '--diff' "${TEST_TMP_DIR}/ansible-playbook.args"
}

@test "ensure-keys is idempotent and uses 0600 private files" {
  run ident ensure-keys
  [ "$status" -eq 0 ]
  [ -f "${LAB_IDENTITIES_DIR}/lab-ansible" ]
  [ -f "${LAB_IDENTITIES_DIR}/lab-admin" ]
  [ ! -f "${LAB_IDENTITIES_DIR}/lab-svc" ]
  local mode
  # GNU stat -f is --file-system (succeeds with garbage); BSD -f is format.
  if stat --version >/dev/null 2>&1; then
    mode="$(stat -c '%a' "${LAB_IDENTITIES_DIR}/lab-ansible")"
  else
    mode="$(stat -f '%OLp' "${LAB_IDENTITIES_DIR}/lab-ansible")"
  fi
  [[ ${mode} == "600" || ${mode} == "0600" ]]
  printf 'keep-me\n' >"${LAB_IDENTITIES_DIR}/lab-ansible"
  run ident ensure-keys
  [ "$status" -eq 0 ]
  grep -q 'keep-me' "${LAB_IDENTITIES_DIR}/lab-ansible"
}

@test "apply --yes invokes ansible-playbook without --check" {
  run ident apply --yes
  [ "$status" -eq 0 ]
  [[ -s ${TEST_TMP_DIR}/ansible-playbook.args ]]
  if grep -q -- '--check' "${TEST_TMP_DIR}/ansible-playbook.args"; then
    echo "apply must not pass --check" >&2
    return 1
  fi
}

@test "ping requires a day-2 private key" {
  rm -f "${LAB_IDENTITIES_DIR}/lab-ansible"
  run ident ping
  [ "$status" -ne 0 ]
  [[ "$output" == *"ensure-keys"* ]]
}

@test "ping succeeds when the day-2 private key exists" {
  run ident ensure-keys
  [ "$status" -eq 0 ]
  run ident ping
  [ "$status" -eq 0 ]
  [[ "$output" == *"pong"* ]]
  [[ "$output" != *"BEGIN OPENSSH"* ]]
}
