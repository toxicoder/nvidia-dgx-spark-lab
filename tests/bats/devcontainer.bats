#!/usr/bin/env bats
#
# Hermetic tests for .devcontainer contributor tooling (pins, doctor, post-create).

load 'test_helper'

setup() {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  export DEVCONTAINER_DIR="${REPO_ROOT}/.devcontainer"
}

@test "tool-versions.env exists and is bash-sourceable" {
  [[ -f "${DEVCONTAINER_DIR}/tool-versions.env" ]]
  run bash -c "set -a; source '${DEVCONTAINER_DIR}/tool-versions.env'; set +a; test -n \"\${BAZELISK_VERSION}\" && test -n \"\${KUBECONFORM_VERSION}\" && test -n \"\${NODE_MAJOR}\""
  [ "$status" -eq 0 ]
}

@test "Dockerfile does not download unpinned releases/latest for CLIs" {
  # Allow commenting about latest, but not using the GitHub releases/latest URL.
  run grep -E 'https://.*/releases/latest/' "${DEVCONTAINER_DIR}/Dockerfile"
  [ "$status" -ne 0 ]
}

@test "Dockerfile is multi-arch (amd64 and arm64)" {
  run grep -E 'amd64|arm64|TARGETARCH' "${DEVCONTAINER_DIR}/Dockerfile"
  [ "$status" -eq 0 ]
  grep -q 'amd64' "${DEVCONTAINER_DIR}/Dockerfile"
  grep -q 'arm64' "${DEVCONTAINER_DIR}/Dockerfile"
}

@test "Dockerfile and install-lint-tools pin match tool-versions.env" {
  # shellcheck disable=SC1091
  source "${DEVCONTAINER_DIR}/tool-versions.env"
  grep -q "${BAZELISK_VERSION}" "${DEVCONTAINER_DIR}/Dockerfile"
  grep -q "${BUILDIFIER_VERSION}" "${DEVCONTAINER_DIR}/Dockerfile"
  grep -q "${SHFMT_ASSET_VERSION}" "${DEVCONTAINER_DIR}/Dockerfile"
  grep -q "${KUBECONFORM_VERSION}" "${DEVCONTAINER_DIR}/Dockerfile"
  grep -q "${HELM_VERSION}" "${DEVCONTAINER_DIR}/Dockerfile"
  grep -q "${KUBECTL_VERSION}" "${DEVCONTAINER_DIR}/Dockerfile"

  # CI installer (scripts/ci; .github wrapper delegates here) must source SSOT.
  local installer="${REPO_ROOT}/scripts/ci/install-lint-tools.sh"
  [[ -f "${installer}" ]]
  grep -q "tool-versions.env" "${installer}"
  grep -q "amd64" "${installer}"
  grep -q "arm64" "${installer}"
}

@test "doctor.sh --help prints usage" {
  run bash "${DEVCONTAINER_DIR}/doctor.sh" --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage:"* ]]
  [[ "$output" == *"Apple Silicon"* ]] || [[ "$output" == *"arm64"* ]]
}

@test "doctor.sh fails when required tools are missing from PATH" {
  # Minimal PATH without project CLIs — must exit non-zero under strict mode.
  run env PATH="/usr/bin:/bin" DEVCONTAINER_DOCTOR_STRICT=1 \
    bash "${DEVCONTAINER_DIR}/doctor.sh" --quiet
  [ "$status" -eq 1 ]
}

@test "doctor.sh strict=0 exits 0 even when tools missing" {
  run env PATH="/usr/bin:/bin" DEVCONTAINER_DOCTOR_STRICT=0 \
    bash "${DEVCONTAINER_DIR}/doctor.sh" --quiet
  [ "$status" -eq 0 ]
}

@test "post-create.sh --help prints usage" {
  run bash "${DEVCONTAINER_DIR}/post-create.sh" --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage:"* ]]
  [[ "$output" == *"--deps-only"* ]]
}

@test "devcontainer.json uses docker-outside-of-docker and Node 22" {
  grep -q 'docker-outside-of-docker' "${DEVCONTAINER_DIR}/devcontainer.json"
  grep -q '"version": "22"' "${DEVCONTAINER_DIR}/devcontainer.json"
  # Must not enable both DinD and get.docker.com dual install path in json features.
  run grep -E 'docker-in-docker' "${DEVCONTAINER_DIR}/devcontainer.json"
  [ "$status" -ne 0 ]
}
