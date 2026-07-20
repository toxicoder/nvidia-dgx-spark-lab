#!/usr/bin/env bash
#
# ## CI lint tool installer
#
# Install host lint and formatter binaries on Ubuntu GitHub/Gitea runners.
# Shared by CI workflow jobs to avoid duplicating apt/pip/curl setup steps.
#
# Installs:
#   - shellcheck, yamllint (apt)
#   - ansible, ansible-lint, ruff, mypy, prettier (pip / npm)
#   - kubeconform, buildifier, shfmt (release binaries)
#
# **Safety**:
# - Installs to system paths only; does not modify repo sources or cluster config.
# - Requires `sudo` for apt and `/usr/local/bin` placement.
# - When LINT_BINS_CACHE_HIT=true, skips re-downloading release binaries.
#
# Usage (internal — called from setup-bazel / CI):
#   .github/scripts/install-lint-tools.sh
#
set -euo pipefail

echo "Installing base lint tools..."

sudo apt-get update -qq
sudo apt-get install -y -qq shellcheck yamllint curl jq

python -m pip install --upgrade pip
# ansible/ruff/mypy for lint jobs; pytest for //docs:test_python_coverage (//:test-fast)
pip install ansible ansible-lint yamllint ruff mypy pytest pytest-cov

# prettier for //lints:yaml_format (avoid npx download on every run)
if ! command -v prettier >/dev/null 2>&1; then
  npm install -g prettier@3.5.3 >/dev/null 2>&1 || \
    sudo npm install -g prettier@3.5.3
fi

install_release_bins() {
  # kubeconform: pin a real release tag.
  KUBECONFORM_VERSION="${KUBECONFORM_VERSION:-v0.6.7}"
  curl -fsSL "https://github.com/yannh/kubeconform/releases/download/${KUBECONFORM_VERSION}/kubeconform-linux-amd64.tar.gz" \
    -o /tmp/kubeconform.tgz
  tar -xzf /tmp/kubeconform.tgz -C /tmp
  sudo mv /tmp/kubeconform /usr/local/bin/
  kubeconform -v

  # buildifier (Bazel BUILD/.bzl lint)
  curl -fsSL https://github.com/bazelbuild/buildtools/releases/download/v8.2.1/buildifier-linux-amd64 \
    -o /tmp/buildifier
  sudo install /tmp/buildifier /usr/local/bin/buildifier
  buildifier --version || buildifier -version || true

  # shfmt (trusted shell formatter) - architecture aware for amd64 + arm64
  arch=$(uname -m)
  if [ "$arch" = "x86_64" ]; then
    curl -fsSL https://github.com/mvdan/sh/releases/download/v3.10.0/shfmt_v3.10.0_linux_amd64 \
      -o /tmp/shfmt
  elif [ "$arch" = "aarch64" ] || [ "$arch" = "arm64" ]; then
    curl -fsSL https://github.com/mvdan/sh/releases/download/v3.10.0/shfmt_v3.10.0_linux_arm64 \
      -o /tmp/shfmt
  else
    echo "install-lint-tools: unsupported arch $arch for shfmt" >&2
    return 1
  fi
  sudo install /tmp/shfmt /usr/local/bin/shfmt
}

if [[ "${LINT_BINS_CACHE_HIT:-}" == "true" ]] \
  && command -v kubeconform >/dev/null 2>&1 \
  && command -v buildifier >/dev/null 2>&1 \
  && command -v shfmt >/dev/null 2>&1; then
  echo "Lint release binaries restored from cache."
  sudo chmod +x /usr/local/bin/kubeconform /usr/local/bin/buildifier /usr/local/bin/shfmt || true
else
  install_release_bins
fi

echo "Lint + formatter tools installed."
