#!/usr/bin/env bats
#
# Hermetic tests for .devcontainer contributor tooling (pins, doctor, post-create).

load 'test_helper'

setup() {
  REPO_ROOT="$(bats_canonical_repo_root)"
  export REPO_ROOT
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

@test "Dockerfile RUN shell supports pipefail (bash SHELL, not dash)" {
  # Ubuntu /bin/sh is dash; `set -o pipefail` under default RUN fails the image build.
  # Require an explicit bash SHELL (or no bare `RUN set … pipefail`).
  if grep -Eq '^SHELL[[:space:]]*\[.*bash' "${DEVCONTAINER_DIR}/Dockerfile"; then
    return 0
  fi
  run grep -E '^RUN[[:space:]]+set[[:space:]]+-[^;]*pipefail' "${DEVCONTAINER_DIR}/Dockerfile"
  [ "$status" -ne 0 ]
}

@test "Dockerfile does not hardcode TARGETARCH default to amd64" {
  # BuildKit injects TARGETARCH from the target platform; a default of amd64
  # incorrectly pulls amd64 binaries on Apple Silicon / DGX Spark (arm64).
  run grep -E '^ARG[[:space:]]+TARGETARCH=' "${DEVCONTAINER_DIR}/Dockerfile"
  [ "$status" -ne 0 ]
  grep -Eq '^ARG[[:space:]]+TARGETARCH([[:space:]]|$)' "${DEVCONTAINER_DIR}/Dockerfile"
}

@test "Dockerfile pip install is compatible with Ubuntu 22.04 stock pip" {
  # jammy pip 22.x rejects --break-system-packages (added in pip 23 / PEP 668).
  run grep -E 'pip3? install .*--break-system-packages' "${DEVCONTAINER_DIR}/Dockerfile"
  [ "$status" -ne 0 ]
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
  [[ -f ${installer} ]]
  grep -q "tool-versions.env" "${installer}"
  grep -q "amd64" "${installer}"
  grep -q "arm64" "${installer}"
}

@test "doctor.sh --help prints usage" {
  run bash "${DEVCONTAINER_DIR}/doctor.sh" --help
  [ "$status" -eq 0 ]
  [[ $output == *"Usage:"* ]]
  [[ $output == *"Apple Silicon"* ]] || [[ $output == *"arm64"* ]]
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
  [[ $output == *"Usage:"* ]]
  [[ $output == *"--deps-only"* ]]
}

@test "devcontainer.json uses docker-outside-of-docker and Node 22" {
  grep -q 'docker-outside-of-docker' "${DEVCONTAINER_DIR}/devcontainer.json"
  grep -q '"version": "22"' "${DEVCONTAINER_DIR}/devcontainer.json"
  # Must not enable both DinD and get.docker.com dual install path in json features.
  run grep -E 'docker-in-docker' "${DEVCONTAINER_DIR}/devcontainer.json"
  [ "$status" -ne 0 ]
}

@test "install-agent-clis.sh exists and is executable help-safe" {
  [[ -f "${DEVCONTAINER_DIR}/install-agent-clis.sh" ]]
  run bash "${DEVCONTAINER_DIR}/install-agent-clis.sh" --help
  [ "$status" -eq 0 ]
  [[ $output == *"grok"* ]] || [[ $output == *"Grok"* ]]
  [[ $output == *"hermes"* ]] || [[ $output == *"Hermes"* ]]
}

@test "devcontainer mounts persist agent home dirs without embedding secrets" {
  grep -q 'dgx-lab-grok-home' "${DEVCONTAINER_DIR}/devcontainer.json"
  grep -q 'dgx-lab-hermes-home' "${DEVCONTAINER_DIR}/devcontainer.json"
  grep -q '/home/vscode/.grok' "${DEVCONTAINER_DIR}/devcontainer.json"
  grep -q '/home/vscode/.hermes' "${DEVCONTAINER_DIR}/devcontainer.json"
}

@test "devcontainer does not forward host secret env via localEnv" {
  # Never ship API keys / deployment keys into container metadata.
  run grep -E 'localEnv:.*(API_KEY|TOKEN|SECRET|PASSWORD|GROK_DEPLOYMENT)' \
    "${DEVCONTAINER_DIR}/devcontainer.json"
  [ "$status" -ne 0 ]
}

@test "devcontainer sources have no live-looking API key material" {
  # sk-… live keys, non-empty GROK_DEPLOYMENT_KEY assignments, export KEY=secret.
  # Placeholders like none / change-me / empty are allowed in comments/docs.
  run grep -RE \
    'sk-[A-Za-z0-9]{16,}|GROK_DEPLOYMENT_KEY=[[:alnum:]_-]{8,}|export[[:space:]]+[A-Z0-9_]*(API_KEY|TOKEN|SECRET|PASSWORD)=[^n"'\''[:space:]]{8,}' \
    "${DEVCONTAINER_DIR}"
  [ "$status" -ne 0 ]
}

@test "post-create wires agent CLI installer" {
  grep -q 'install-agent-clis' "${DEVCONTAINER_DIR}/post-create.sh"
}

@test "Dockerfile pre-creates vscode agent home dirs for named volume ownership" {
  # Empty named volumes over ~/.grok and ~/.hermes are root-owned unless the
  # image pre-creates those paths as vscode (Docker copies image content into
  # a new empty volume, including ownership). Paths may be on continuation
  # lines under a single mkdir -p / chown layer.
  run awk '
    /mkdir -p/ { in_mkdir=1 }
    in_mkdir && /\.grok/ { grok=1 }
    in_mkdir && /\.hermes/ { hermes=1 }
    /chown -R/ && in_mkdir { exit }
    END { exit !(grok && hermes) }
  ' "${DEVCONTAINER_DIR}/Dockerfile"
  [ "$status" -eq 0 ]
}

@test "install-agent-clis ensures agent home dirs are writable" {
  # Existing root-owned volumes are fixed at runtime (sudo chown) before installers.
  grep -Eq 'chown|writable|ensure_agent' "${DEVCONTAINER_DIR}/install-agent-clis.sh"
  grep -q '\.grok' "${DEVCONTAINER_DIR}/install-agent-clis.sh"
  grep -q '\.hermes' "${DEVCONTAINER_DIR}/install-agent-clis.sh"
}

@test "devcontainer-lock.json pins declared features with digests" {
  local lock="${DEVCONTAINER_DIR}/devcontainer-lock.json"
  [[ -f ${lock} ]]
  grep -q 'docker-outside-of-docker' "${lock}"
  grep -q 'ghcr.io/devcontainers/features/node' "${lock}"
  grep -q 'ghcr.io/devcontainers/features/python' "${lock}"
  grep -q '"resolved"' "${lock}"
  grep -q 'sha256:' "${lock}"
}

@test "hermes installer skips interactive setup during create" {
  # post-create must install the CLI only; never run the Blank Slate wizard.
  # Official install.sh: --skip-setup / --non-interactive (see install-agent-clis.sh).
  grep -q -- '--skip-setup' "${DEVCONTAINER_DIR}/install-agent-clis.sh"
  grep -q -- '--non-interactive' "${DEVCONTAINER_DIR}/install-agent-clis.sh"
  # Install pipe must pass both flags (not bare curl | bash).
  grep -Eq 'bash -s -- .*--skip-setup|--skip-setup.*--non-interactive' \
    "${DEVCONTAINER_DIR}/install-agent-clis.sh"
  # No executable invocation of hermes setup outside help/comments (footer may document it).
  ! grep -Eq '(^|[[:space:];|&])(bash|command|exec)[[:space:]].*hermes[[:space:]]+setup' \
    "${DEVCONTAINER_DIR}/post-create.sh" "${DEVCONTAINER_DIR}/install-agent-clis.sh"
}

@test "setup-docs recreates unusable host venvs" {
  local setup="${REPO_ROOT}/docs/setup-docs.sh"
  [[ -f ${setup} ]]
  # Usability check + recreate path (host macOS venv bind-mounted into Linux).
  grep -Eq 'docs_venv_is_usable|venv_is_usable' "${setup}"
  grep -Eq 'rm -rf|recreat' "${setup}"
}

@test "setup-docs recreates a broken venv and yields a working python" {
  local setup="${REPO_ROOT}/docs/setup-docs.sh"
  [[ -f ${setup} ]]
  local tmp
  tmp="$(mktemp -d "${BATS_TEST_TMPDIR:-/tmp}/docs-venv-XXXXXX")"
  mkdir -p "${tmp}/docs" "${tmp}/.venv-docs/bin"
  # Minimal requirements so pip is cheap.
  : >"${tmp}/docs/requirements.txt"
  cp "${setup}" "${tmp}/docs/setup-docs.sh"
  # Host-style broken venv (macOS absolute python + non-local activate path).
  cat >"${tmp}/.venv-docs/pyvenv.cfg" <<'EOF'
home = /Library/Frameworks/Python.framework/Versions/3.13/bin
include-system-site-packages = false
version = 3.13.2
executable = /Library/Frameworks/Python.framework/Versions/3.13/bin/python3.13
command = /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 -m venv /Users/alx/code/repo/.venv-docs
EOF
  ln -sfn /Library/Frameworks/Python.framework/Versions/3.13/bin/python3.13 \
    "${tmp}/.venv-docs/bin/python3.13"
  ln -sfn python3.13 "${tmp}/.venv-docs/bin/python"
  ln -sfn python3.13 "${tmp}/.venv-docs/bin/python3"
  cat >"${tmp}/.venv-docs/bin/activate" <<EOF
# broken host activate
VIRTUAL_ENV=/Users/alx/code/repo/.venv-docs
export VIRTUAL_ENV
PATH="\$VIRTUAL_ENV/bin:\$PATH"
export PATH
EOF
  run env QUIET=true bash "${tmp}/docs/setup-docs.sh"
  [ "$status" -eq 0 ]
  [[ -x "${tmp}/.venv-docs/bin/python" ]]
  run "${tmp}/.venv-docs/bin/python" -c 'import sys; assert sys.prefix'
  [ "$status" -eq 0 ]
  rm -rf "${tmp}"
}

@test "doctor warns on broken docs venv when present" {
  grep -Eq 'venv-docs|docs venv|docs virtualenv' "${DEVCONTAINER_DIR}/doctor.sh"
}

@test "devcontainer pins mypy interpreter and excludes site from analysis" {
  local json="${DEVCONTAINER_DIR}/devcontainer.json"
  local settings="${REPO_ROOT}/.vscode/settings.json"
  grep -q 'mypy-type-checker.interpreter' "${json}" ||
    grep -q 'mypy-type-checker.interpreter' "${settings}"
  grep -q 'python.analysis.exclude' "${json}" ||
    grep -q 'python.analysis.exclude' "${settings}"
  grep -q 'bazel.executable' "${json}" ||
    grep -q 'bazel.executable' "${settings}"
}

@test "workspace vscode settings optimize mypy strict and toolchain parity" {
  local settings="${REPO_ROOT}/.vscode/settings.json"
  [[ -f ${settings} ]]
  # Mypy owns type correctness (strict mypy.ini); Pylance typecheck stays off.
  grep -q 'mypy.ini' "${settings}"
  grep -q 'mypy-type-checker.preferDaemon' "${settings}"
  grep -q 'mypy-type-checker.ignorePatterns' "${settings}"
  grep -q 'mypy-type-checker.importStrategy' "${settings}"
  grep -Eq '"python\.analysis\.typeCheckingMode"[[:space:]]*:[[:space:]]*"off"' "${settings}"
  # Pylance default-style excludes + optional-workload import noise suppressed.
  grep -q '__pycache__' "${settings}"
  grep -Fq '"**/.*"' "${settings}"
  grep -q 'reportMissingImports' "${settings}"
  # Dashboard TS SDK uses non-deprecated js/ts.* keys.
  grep -q 'js/ts.tsdk.path' "${settings}"
  ! grep -q '"typescript.tsdk"' "${settings}"
  # Ruff is SSOT for format + ANN-friendly lint (ruff.toml).
  grep -q 'ruff.toml' "${settings}"
  grep -q 'ruff.configurationPreference' "${settings}"
  # Portable only: no container absolute python path in workspace settings.
  ! grep -q '/usr/local/python/current' "${settings}"
  # Rebase-oriented git workflow (matches protected linear history).
  grep -Eq '"git\.pull\.rebase"[[:space:]]*:[[:space:]]*true' "${settings}"
  # Shell parity with //lints:shfmt and shellcheck warnings-as-defects.
  grep -q -- '-severity=warning' "${settings}"
  grep -q -- '-i' "${settings}"
}

@test "post-create prewarms bazelisk to avoid IDE first-query race" {
  grep -Eq 'bazelisk (version|info)' "${DEVCONTAINER_DIR}/post-create.sh"
}
