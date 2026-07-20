#!/usr/bin/env bash
#
# ## CI lint tool installer
#
# Install host lint and formatter binaries on Ubuntu GitHub/Gitea runners
# (and optionally other Linux hosts). Shared by setup-bazel and local bootstrap.
#
# Versions come from .devcontainer/tool-versions.env (single source of truth).
# Supports linux/amd64 and linux/arm64 (DGX Spark Grace, multi-arch self-hosted).
#
# Installs:
#   - shellcheck, yamllint, jq (apt)
#   - ansible, ansible-lint, ruff, mypy, prettier, pytest (pip / npm)
#   - kubeconform, buildifier, shfmt (release binaries, arch-aware)
#
# **Safety**:
# - Installs to system paths only; does not modify repo sources or cluster config.
# - Requires `sudo` for apt and `/usr/local/bin` placement when not root.
# - When LINT_BINS_CACHE_HIT=true, skips re-downloading release binaries.
#
# Usage (internal — called from setup-bazel / CI):
#   .github/scripts/install-lint-tools.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# scripts/ci → repo root
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VERSIONS_FILE="${REPO_ROOT}/.devcontainer/tool-versions.env"

if [[ ! -f ${VERSIONS_FILE} ]]; then
  echo "install-lint-tools: missing ${VERSIONS_FILE}" >&2
  exit 1
fi

set -a
# shellcheck source=../../.devcontainer/tool-versions.env disable=SC1091
source "${VERSIONS_FILE}"
set +a

: "${KUBECONFORM_VERSION:?}"
: "${BUILDIFIER_VERSION:?}"
: "${SHFMT_ASSET_VERSION:?}"
: "${PRETTIER_VERSION:?}"

echo "Installing base lint tools (pins from tool-versions.env)..."

run_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

run_root apt-get update -qq
run_root apt-get install -y -qq shellcheck yamllint curl jq

python -m pip install --upgrade pip
# ansible/ruff/mypy for lint jobs; pytest for //docs:test_python_coverage (//:test-fast)
pip install ansible ansible-lint yamllint ruff mypy pytest pytest-cov

# prettier for //lints:yaml_format (avoid npx download on every run)
if ! command -v prettier >/dev/null 2>&1; then
  if command -v npm >/dev/null 2>&1; then
    npm install -g "prettier@${PRETTIER_VERSION}" >/dev/null 2>&1 ||
      run_root npm install -g "prettier@${PRETTIER_VERSION}"
  else
    echo "install-lint-tools: npm not found; prettier install deferred" >&2
  fi
fi

# Map uname -m → release asset arch (amd64|arm64).
detect_arch() {
  local m
  m="$(uname -m)"
  case "$m" in
    x86_64 | amd64) echo "amd64" ;;
    aarch64 | arm64) echo "arm64" ;;
    *)
      echo "install-lint-tools: unsupported arch $m (need x86_64 or aarch64)" >&2
      return 1
      ;;
  esac
}

install_release_bins() {
  local arch
  arch="$(detect_arch)"

  curl -fsSL "https://github.com/yannh/kubeconform/releases/download/${KUBECONFORM_VERSION}/kubeconform-linux-${arch}.tar.gz" \
    -o /tmp/kubeconform.tgz
  tar -xzf /tmp/kubeconform.tgz -C /tmp
  run_root mv /tmp/kubeconform /usr/local/bin/
  kubeconform -v

  curl -fsSL "https://github.com/bazelbuild/buildtools/releases/download/${BUILDIFIER_VERSION}/buildifier-linux-${arch}" \
    -o /tmp/buildifier
  run_root install /tmp/buildifier /usr/local/bin/buildifier
  buildifier --version || buildifier -version || true

  curl -fsSL "https://github.com/mvdan/sh/releases/download/v${SHFMT_ASSET_VERSION}/shfmt_v${SHFMT_ASSET_VERSION}_linux_${arch}" \
    -o /tmp/shfmt
  run_root install /tmp/shfmt /usr/local/bin/shfmt
  shfmt --version
}

if [[ ${LINT_BINS_CACHE_HIT:-} == "true" ]] &&
  command -v kubeconform >/dev/null 2>&1 &&
  command -v buildifier >/dev/null 2>&1 &&
  command -v shfmt >/dev/null 2>&1; then
  echo "Lint release binaries restored from cache."
  run_root chmod +x /usr/local/bin/kubeconform /usr/local/bin/buildifier /usr/local/bin/shfmt || true
else
  install_release_bins
fi

echo "Lint + formatter tools installed (kubeconform ${KUBECONFORM_VERSION}, buildifier ${BUILDIFIER_VERSION}, shfmt v${SHFMT_ASSET_VERSION})."
