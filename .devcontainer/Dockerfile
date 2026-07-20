# syntax=docker/dockerfile:1
# ## Contributor dev image for nvidia-dgx-spark-lab
#
# Multi-arch Linux image (linux/amd64 + linux/arm64) so the same definition
# works on:
#   - Apple Silicon (arm64 host → arm64 container via Docker Desktop)
#   - Intel Mac / Windows x86_64 / Linux amd64 (Docker Desktop or native)
#   - NVIDIA DGX Spark (Grace ARM64) running Docker/Podman
#
# Tool versions: .devcontainer/tool-versions.env (single source of truth).
# Docker engine: provided by the docker-outside-of-docker feature (host socket),
# not installed in this Dockerfile.
#
# Build context: .devcontainer/ (see devcontainer.json).

FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# Injected by BuildKit from --platform / host arch (amd64|arm64). Do not
# hardcode a default — ARG TARGETARCH=amd64 incorrectly pulls amd64 binaries
# on Apple Silicon and DGX Spark (Grace arm64).
ARG TARGETARCH
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

# Ubuntu /bin/sh is dash; pipefail and other bashisms need bash for RUN layers.
SHELL ["/bin/bash", "-euo", "pipefail", "-c"]

# Pins (must match tool-versions.env — enforced by tests/bats/devcontainer.bats)
ARG BAZELISK_VERSION=v1.25.0
ARG BUILDIFIER_VERSION=v8.2.1
ARG SHFMT_ASSET_VERSION=3.10.0
ARG KUBECONFORM_VERSION=v0.8.0
ARG HELM_VERSION=v3.15.0
ARG KUBECTL_VERSION=v1.30.14
ARG PRETTIER_VERSION=3.9.4

COPY tool-versions.env /tmp/tool-versions.env

# Single apt layer: base CLIs used by //:lint, BATS, docs, and k8s smoke paths.
RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-transport-https \
    build-essential \
    ca-certificates \
    curl \
    fd-find \
    fzf \
    git \
    gnupg \
    jq \
    kcov \
    lsb-release \
    make \
    python3 \
    python3-pip \
    python3-venv \
    ripgrep \
    shellcheck \
    bats \
    wget \
    yamllint \
    unzip \
    xz-utils \
    && rm -rf /var/lib/apt/lists/* \
    && (command -v fdfind >/dev/null && ln -sf "$(command -v fdfind)" /usr/local/bin/fd || true)

# Map Docker TARGETARCH → upstream asset names (amd64|arm64 only).
# SHELL above already enables set -euo pipefail for this RUN.
RUN case "${TARGETARCH}" in \
      amd64|arm64) ARCH="${TARGETARCH}" ;; \
      *) echo "Unsupported TARGETARCH=${TARGETARCH} (need amd64 or arm64)" >&2; exit 1 ;; \
    esac; \
    echo "Installing pinned CLIs for linux/${ARCH}..."; \
    # kubectl (pinned; matches kubeconform kubernetes 1.30 schema minor)
    curl -fsSL "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${ARCH}/kubectl" \
      -o /usr/local/bin/kubectl \
    && chmod +x /usr/local/bin/kubectl \
    && kubectl version --client; \
    # Helm
    curl -fsSL "https://get.helm.sh/helm-${HELM_VERSION}-linux-${ARCH}.tar.gz" \
      -o /tmp/helm.tgz \
    && tar -xzf /tmp/helm.tgz -C /tmp \
    && install "/tmp/linux-${ARCH}/helm" /usr/local/bin/helm \
    && rm -rf /tmp/helm.tgz "/tmp/linux-${ARCH}" \
    && helm version; \
    # Bazelisk
    curl -fsSL "https://github.com/bazelbuild/bazelisk/releases/download/${BAZELISK_VERSION}/bazelisk-linux-${ARCH}" \
      -o /usr/local/bin/bazelisk \
    && chmod +x /usr/local/bin/bazelisk \
    && ln -sf /usr/local/bin/bazelisk /usr/local/bin/bazel \
    && bazelisk version; \
    # Buildifier
    curl -fsSL "https://github.com/bazelbuild/buildtools/releases/download/${BUILDIFIER_VERSION}/buildifier-linux-${ARCH}" \
      -o /usr/local/bin/buildifier \
    && chmod +x /usr/local/bin/buildifier \
    && buildifier --version || true; \
    # shfmt
    curl -fsSL "https://github.com/mvdan/sh/releases/download/v${SHFMT_ASSET_VERSION}/shfmt_v${SHFMT_ASSET_VERSION}_linux_${ARCH}" \
      -o /usr/local/bin/shfmt \
    && chmod +x /usr/local/bin/shfmt \
    && shfmt --version; \
    # kubeconform
    curl -fsSL "https://github.com/yannh/kubeconform/releases/download/${KUBECONFORM_VERSION}/kubeconform-linux-${ARCH}.tar.gz" \
      -o /tmp/kubeconform.tgz \
    && tar -xzf /tmp/kubeconform.tgz -C /usr/local/bin kubeconform \
    && chmod +x /usr/local/bin/kubeconform \
    && rm -f /tmp/kubeconform.tgz \
    && kubeconform -v

# Python lint/test/docs helpers (feature may also install Python 3.11; these are PATH tools).
# ansible via pip for consistent version across amd64/arm64.
# Ubuntu 22.04 ships pip 22.x without --break-system-packages (PEP 668 flag is
# pip ≥23); jammy is not externally-managed, so a plain system install is fine.
RUN pip3 install --no-cache-dir \
    "ansible>=2.14" \
    ansible-lint \
    mypy \
    pre-commit \
    pytest \
    pytest-cov \
    ruff \
    types-PyYAML \
    yamllint

# prettier for //lints:yaml_format and //:fix (Node feature installs npm later;
# re-run in a later layer isn't possible after features — install via standalone binary fallback).
# Prefer npm when available post-features; bake a node-based global when node exists,
# otherwise install a platform binary via npm's optional path during post-create.
# Here we only ensure pip/apt tools; prettier is installed in a small step using
# the node that may not exist yet. post-create + doctor treat prettier as optional
# if dashboard/node_modules/.bin/prettier exists after npm ci.
#
# Install prettier with a tiny standalone approach: download npm's prettier package
# is deferred to post-create when Node feature is present. CI install-lint-tools
# installs the same PRETTIER_VERSION globally.

ARG USERNAME=vscode
RUN if ! id -u "${USERNAME}" >/dev/null 2>&1; then \
      useradd -m -s /bin/bash "${USERNAME}"; \
    fi \
    && mkdir -p /home/${USERNAME}/.cache/bazel-disk \
                /home/${USERNAME}/.cache/bazel-repo \
                /home/${USERNAME}/.cache/pip \
                /home/${USERNAME}/.cache/ms-playwright \
                /home/${USERNAME}/.npm \
                /home/${USERNAME}/.local/bin \
                /home/${USERNAME}/.grok \
                /home/${USERNAME}/.hermes \
    && chown -R ${USERNAME}:${USERNAME} /home/${USERNAME}

# Welcome banner (linux container; host can be macOS/Windows/Spark).
USER ${USERNAME}
RUN printf '%s\n' \
  'echo "nvidia-dgx-spark-lab dev container ($(uname -m))"' \
  'echo "  doctor:  bash .devcontainer/doctor.sh"' \
  'echo "  fix:     bazelisk run //:fix"' \
  'echo "  validate: bazelisk run //:validate"' \
  'echo "  docs:    bazelisk run //docs:serve -- --port 8080"' \
  >> ~/.bashrc

# Do not hardcode WORKDIR to a fixed clone path — Dev Containers set workspaceFolder.
WORKDIR /workspaces
