#!/usr/bin/env bash
#
# ## CI lint tool installer
#
# Install host lint and formatter binaries on Ubuntu GitHub/Gitea runners.
# Shared by CI workflow jobs to avoid duplicating apt/pip/curl setup steps.
#
# Installs:
#   - shellcheck, yamllint (apt)
#   - ansible, ansible-lint, ruff (pip)
#   - kubeconform, buildifier, shfmt (release binaries)
#
# **Safety**:
# - Installs to system paths only; does not modify repo sources or cluster config.
# - Requires `sudo` for apt and `/usr/local/bin` placement.
#
# Usage (internal — called from `.github/workflows/ci.yml`):
#   .github/scripts/install-lint-tools.sh
#
set -euo pipefail

echo "Installing base lint tools..."

sudo apt-get update -qq
sudo apt-get install -y -qq shellcheck yamllint curl jq

python -m pip install --upgrade pip
pip install ansible ansible-lint yamllint ruff

curl -sL https://github.com/yannh/kubeconform/releases/download/v1.30.0/kubeconform-linux-amd64.tar.gz | tar xz
sudo mv kubeconform /usr/local/bin/
kubeconform -v

# buildifier (Bazel BUILD/.bzl lint)
curl -L https://github.com/bazelbuild/buildtools/releases/latest/download/buildifier-linux-amd64 -o /usr/local/bin/buildifier
chmod +x /usr/local/bin/buildifier
buildifier --version || buildifier -version || true

# shfmt (trusted shell formatter) - architecture aware for amd64 + arm64
arch=$(uname -m)
if [ "$arch" = "x86_64" ]; then
  curl -L https://github.com/mvdan/sh/releases/latest/download/shfmt_v3.10.0_linux_amd64 -o /usr/local/bin/shfmt
  chmod +x /usr/local/bin/shfmt
elif [ "$arch" = "aarch64" ] || [ "$arch" = "arm64" ]; then
  curl -L https://github.com/mvdan/sh/releases/latest/download/shfmt_v3.10.0_linux_arm64 -o /usr/local/bin/shfmt
  chmod +x /usr/local/bin/shfmt
fi

echo "Lint + formatter tools installed."