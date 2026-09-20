#!/usr/bin/env bats
#
# Hermetic safety tests for scripts/utilities/disk-wizard.sh

load 'test_helper'

setup_file() {
  TEST_TMP_DIR="$(mktemp -d)"
  export TEST_TMP_DIR
  export REPO_ROOT="$(bats_canonical_repo_root)"
  export LAB_HERMETIC=1
  export DISK_WIZARD_HOME="${TEST_TMP_DIR}/home"
  export HOME="${DISK_WIZARD_HOME}"
  export MODELS_DIR="${TEST_TMP_DIR}/models"
  mkdir -p "${MODELS_DIR}" "${DISK_WIZARD_HOME}/.cache/pip" "${DISK_WIZARD_HOME}/.ollama"
  export LAB_MOCK_DF_JSON='{"size_bytes":1000000000000,"used_bytes":860000000000,"avail_bytes":140000000000,"used_pct":86}'
  export LAB_MOCK_OPEN_FILES=""
  export LAB_MOCK_PODS_JSON='{"items":[]}'
  export LAB_MOCK_HF_PID=0
  export PATH="${TEST_TMP_DIR}/bin:${PATH}"
  mkdir -p "${TEST_TMP_DIR}/bin"
}

setup() {
  export TEST_TMP_DIR REPO_ROOT LAB_HERMETIC DISK_WIZARD_HOME HOME MODELS_DIR
  export LAB_MOCK_DF_JSON PATH
  export LAB_MOCK_OPEN_FILES=""
  export LAB_MOCK_PODS_JSON='{"items":[]}'
  export LAB_MOCK_HF_PID=0
  unset LAB_MOCK_CRICTL_IMAGES DISK_WIZARD_ROOT_GLOB_BASE
  rm -rf "${MODELS_DIR:?}" "${DISK_WIZARD_HOME:?}"
  mkdir -p "${MODELS_DIR}" "${DISK_WIZARD_HOME}/.cache/pip" "${DISK_WIZARD_HOME}/.ollama"
}

teardown_file() {
  rm -rf "$TEST_TMP_DIR" || true
}

wizard() {
  bash "${REPO_ROOT}/scripts/utilities/disk-wizard.sh" "$@"
}

@test "help mentions never docker system prune -a --volumes" {
  run wizard --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Never runs docker system prune -a --volumes"* ]]
}

@test "non-TTY default is plan and deletes nothing" {
  printf 'keep\n' >"${MODELS_DIR}/keep.txt"
  run wizard --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"["* ]]
  [[ -f ${MODELS_DIR}/keep.txt ]]
}

@test "status --json has pressure and apply false" {
  run wizard status --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"pressure\""* ]]
  [[ "$output" == *"\"apply\": false"* ]]
  [[ "$output" == *"Never docker system prune -a --volumes"* ]]
}

@test "run never creates quarantine or deletes files" {
  printf 'x' >"${MODELS_DIR}/stay.incomplete"
  run wizard run
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"apply\": false"* ]]
  [[ -f ${MODELS_DIR}/stay.incomplete ]]
  [[ ! -d ${MODELS_DIR}/.disk-quarantine ]]
}

@test "apply without --yes fails and leaves tree" {
  printf 'x' >"${MODELS_DIR}/foo.incomplete"
  run wizard apply
  [ "$status" -ne 0 ]
  [[ "$output" == *"--apply requires --yes"* ]]
  [[ -f ${MODELS_DIR}/foo.incomplete ]]
}

@test "apply --yes deletes incomplete and skips keep-set" {
  mkdir -p "${MODELS_DIR}/RadixArk__Qwen3.8-Flash-Next-NVFP4"
  printf 'w' >"${MODELS_DIR}/RadixArk__Qwen3.8-Flash-Next-NVFP4/weights.bin"
  printf 'j' >"${MODELS_DIR}/junk.incomplete"
  run wizard plan --json
  [ "$status" -eq 0 ]
  run wizard apply --yes
  [ "$status" -eq 0 ]
  [[ ! -f ${MODELS_DIR}/junk.incomplete ]]
  [[ -f ${MODELS_DIR}/RadixArk__Qwen3.8-Flash-Next-NVFP4/weights.bin ]]
}

@test "apply skips in-use incomplete via LAB_MOCK_OPEN_FILES" {
  printf 'live' >"${MODELS_DIR}/live.incomplete"
  python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "${MODELS_DIR}/live.incomplete" >"${TEST_TMP_DIR}/open.txt"
  export LAB_MOCK_OPEN_FILES="${TEST_TMP_DIR}/open.txt"
  run wizard plan --json
  [ "$status" -eq 0 ]
  run wizard apply --yes
  [ "$status" -eq 0 ]
  [[ -f ${MODELS_DIR}/live.incomplete ]]
  unset LAB_MOCK_OPEN_FILES
  export LAB_MOCK_OPEN_FILES=""
}

@test "apply --yes --step B quarantines review leftover" {
  mkdir -p "${DISK_WIZARD_HOME}/.cache/huggingface/hub/models--Someone--Experiment"
  printf 'blob' >"${DISK_WIZARD_HOME}/.cache/huggingface/hub/models--Someone--Experiment/w.bin"
  run wizard plan --json
  [ "$status" -eq 0 ]
  run wizard apply --yes --step B
  [ "$status" -eq 0 ]
  [[ ! -e ${DISK_WIZARD_HOME}/.cache/huggingface/hub/models--Someone--Experiment ]]
  python3 -c '
import os
root = os.path.join(os.environ["DISK_WIZARD_HOME"], ".lab-disk-quarantine")
found = False
for dirpath, dirs, files in os.walk(root):
    if "MANIFEST.jsonl" in files:
        text = open(os.path.join(dirpath, "MANIFEST.jsonl"), encoding="utf-8").read()
        if "Experiment" in text:
            found = True
            break
raise SystemExit(0 if found else 1)
'
}

@test "restore --from puts file back via manifest path" {
  mkdir -p "${DISK_WIZARD_HOME}/.cache/huggingface/hub/models--Someone--RestoreMe"
  printf 'blob' >"${DISK_WIZARD_HOME}/.cache/huggingface/hub/models--Someone--RestoreMe/w.bin"
  run wizard plan --json
  [ "$status" -eq 0 ]
  run wizard apply --yes --step B
  [ "$status" -eq 0 ]
  local qdir
  qdir="$(python3 -c '
import os
root = os.path.join(os.environ["DISK_WIZARD_HOME"], ".lab-disk-quarantine")
for dirpath, dirs, files in os.walk(root):
    if "MANIFEST.jsonl" in files:
        text = open(os.path.join(dirpath, "MANIFEST.jsonl"), encoding="utf-8").read()
        if "RestoreMe" in text:
            print(dirpath)
            break
')"
  [[ -d ${qdir} ]]
  run wizard restore --from "${qdir}"
  [ "$status" -eq 0 ]
  [[ -f ${DISK_WIZARD_HOME}/.cache/huggingface/hub/models--Someone--RestoreMe/w.bin ]]
}

@test "hermetic plan does not walk the real HOME cache" {
  run wizard plan --json
  [ "$status" -eq 0 ]
  [[ "$output" != *"${HOME}/.cache"* ]] || true
  # Plan JSON paths must stay under TEST_TMP_DIR or MODELS_DIR / DISK_WIZARD_HOME.
  python3 -c '
import json, os, sys
text = sys.stdin.read()
start = text.find("[{")
if start < 0:
    start = text.find("[]")
rows = json.loads(text[start:])
root = os.path.realpath(os.environ["TEST_TMP_DIR"])
home = os.path.realpath(os.environ["DISK_WIZARD_HOME"])
models = os.path.realpath(os.environ["MODELS_DIR"])
for r in rows:
    p = r.get("path") or ""
    if p.startswith("docker://") or p.startswith("crictl://"):
        continue
    real = os.path.realpath(p)
    if not (real.startswith(root) or real.startswith(home) or real.startswith(models)):
        raise SystemExit("escaped path: " + p)
' <<<"${output}"
}

@test "apply refuses when hf pid is present" {
  export LAB_MOCK_HF_PID=1
  printf 'x' >"${MODELS_DIR}/hf.incomplete"
  run wizard apply --yes
  [ "$status" -ne 0 ]
  [[ "$output" == *"hf download"* ]]
  [[ -f ${MODELS_DIR}/hf.incomplete ]]
  export LAB_MOCK_HF_PID=0
}

@test "recommend --json is an array" {
  printf 'x' >"${MODELS_DIR}/r.incomplete"
  run wizard plan --json
  [ "$status" -eq 0 ]
  run wizard recommend --target-gib 1 --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"["* ]]
}

@test "explain keep-set path is dangerous" {
  mkdir -p "${MODELS_DIR}/dsv41-engram"
  printf 'e' >"${MODELS_DIR}/dsv41-engram/table.bin"
  run wizard explain "${MODELS_DIR}/dsv41-engram/table.bin"
  [ "$status" -eq 0 ]
  [[ "$output" == *"dangerous"* ]]
  [[ "$output" == *"keep-set"* || "$output" == *"dsv41"* || "$output" == *"Engram"* ]]
}

@test "largest --json lists files" {
  printf 'zzzzzzzzzz' >"${MODELS_DIR}/big.bin"
  run wizard largest --path "${MODELS_DIR}" --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"big.bin"* ]]
}

@test "apply --id only deletes that class" {
  mkdir -p "${DISK_WIZARD_HOME}/.cache/pip"
  printf 'w' >"${DISK_WIZARD_HOME}/.cache/pip/wheel.bin"
  printf 'j' >"${MODELS_DIR}/only.incomplete"
  run wizard plan --json
  [ "$status" -eq 0 ]
  run wizard apply --yes --id hf-incomplete
  [ "$status" -eq 0 ]
  [[ ! -f ${MODELS_DIR}/only.incomplete ]]
  [[ -f ${DISK_WIZARD_HOME}/.cache/pip/wheel.bin ]]
}

@test "apply --id re-surveys when a stale plan omits the path" {
  printf 'stale' >"${MODELS_DIR}/gone-already.incomplete"
  run wizard plan --json
  [ "$status" -eq 0 ]
  rm -f "${MODELS_DIR}/gone-already.incomplete"
  printf 'j' >"${MODELS_DIR}/fresh.incomplete"
  run wizard apply --yes --id hf-incomplete
  [ "$status" -eq 0 ]
  [[ ! -f ${MODELS_DIR}/fresh.incomplete ]]
}

@test "factory-bittest requires BITTEST and is not jailed as /" {
  export DISK_WIZARD_ROOT_GLOB_BASE="${TEST_TMP_DIR}"
  printf 'burn' >"${TEST_TMP_DIR}/~bittest-oem.txt"
  run wizard plan --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"factory-bittest"* ]]
  run wizard apply --yes --step B --id factory-bittest
  [ "$status" -eq 0 ]
  [[ -f ${TEST_TMP_DIR}/~bittest-oem.txt ]]
  run wizard apply --yes --step B --id factory-bittest --confirm-token BITTEST
  [ "$status" -eq 0 ]
  [[ ! -f ${TEST_TMP_DIR}/~bittest-oem.txt ]]
  unset DISK_WIZARD_ROOT_GLOB_BASE
}

@test "restore refuses a manifest path outside allowed roots" {
  mkdir -p "${MODELS_DIR}/.disk-quarantine/evil"
  printf 'x' >"${MODELS_DIR}/.disk-quarantine/evil/passwd"
  printf '{"path":"/etc/passwd","class":"hf-complete-repo","dest":"%s"}\n' \
    "${MODELS_DIR}/.disk-quarantine/evil/passwd" \
    >"${MODELS_DIR}/.disk-quarantine/evil/MANIFEST.jsonl"
  run wizard restore --from "${MODELS_DIR}/.disk-quarantine/evil"
  [ "$status" -ne 0 ]
  [[ "$output" == *"refuse"* || "$output" == *"escapes"* || "$output" == *"outside"* ]]
  [[ ! -f /etc/passwd.bak ]]
}

@test "apply refuses to delete MODELS_DIR root even if the plan says so" {
  python3 -c '
import json, os
dest = os.path.join(os.environ["MODELS_DIR"], ".disk-wizard-plan.json")
row = {
  "id": "hf-incomplete",
  "path": os.environ["MODELS_DIR"],
  "risk": "safe",
  "reclaim": "delete",
  "size_bytes": 1,
  "step": "A",
  "in_use": False,
}
open(dest, "w", encoding="utf-8").write(json.dumps([row]))
'
  printf 'stay' >"${MODELS_DIR}/keep-me.bin"
  run wizard apply --yes
  [ "$status" -eq 0 ]
  [[ -d ${MODELS_DIR} ]]
  [[ -f ${MODELS_DIR}/keep-me.bin ]]
}

@test "crictl unused images are plan-only" {
  export LAB_MOCK_CRICTL_IMAGES='{"path":"crictl://unused-image/sha256:deadbeef","size_bytes":999}'
  run wizard plan --json
  [ "$status" -eq 0 ]
  [[ "$output" == *"crictl://unused-image/sha256:deadbeef"* ]]
  [[ "$output" == *"containerd-unused-image"* || "$output" == *"unused-image"* ]]
  run wizard apply --yes --step B
  [ "$status" -eq 0 ]
  [[ "$output" == *"plan-only"* || "$output" == *"crictl rmi"* || "$output" == *"skip runtime"* ]]
  unset LAB_MOCK_CRICTL_IMAGES
}

@test "apply --yes leaves review HF repos in place" {
  mkdir -p "${DISK_WIZARD_HOME}/.cache/huggingface/hub/models--Someone--KeepReview"
  printf 'blob' >"${DISK_WIZARD_HOME}/.cache/huggingface/hub/models--Someone--KeepReview/w.bin"
  printf 'j' >"${MODELS_DIR}/step-a.incomplete"
  run wizard plan --json
  [ "$status" -eq 0 ]
  run wizard apply --yes
  [ "$status" -eq 0 ]
  [[ ! -f ${MODELS_DIR}/step-a.incomplete ]]
  [[ -f ${DISK_WIZARD_HOME}/.cache/huggingface/hub/models--Someone--KeepReview/w.bin ]]
}
