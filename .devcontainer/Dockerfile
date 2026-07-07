# .devcontainer/Dockerfile
# Developer container for nvidia-dgx-spark-lab
# Supports multiple architectures (including x86_64 and Apple Silicon arm64).
# Uses a multi-arch base image for broad workstation compatibility.

FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# Build arg set automatically by Docker buildx for target architecture
ARG TARGETARCH=amd64

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install base tools and project dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    wget \
    git \
    make \
    jq \
    python3 \
    python3-pip \
    python3-venv \
    ansible \
    shellcheck \
    bats \
    kcov \
    yamllint \
    # For Kubernetes / Helm work
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Install kubectl (architecture-aware)
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/${TARGETARCH}/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

# Install Helm (get-helm.sh auto-detects architecture)
RUN curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 \
    && chmod +x get_helm.sh \
    && ./get_helm.sh --version v3.15.0 \
    && rm get_helm.sh

# Install Bazelisk (architecture-aware)
RUN case "${TARGETARCH}" in \
      amd64) BAZEL_ARCH=amd64 ;; \
      arm64) BAZEL_ARCH=arm64 ;; \
      *) echo "Unsupported arch: ${TARGETARCH}"; exit 1 ;; \
    esac && \
    curl -L https://github.com/bazelbuild/bazelisk/releases/latest/download/bazelisk-linux-${BAZEL_ARCH} -o /usr/local/bin/bazelisk \
    && chmod +x /usr/local/bin/bazelisk \
    && ln -s /usr/local/bin/bazelisk /usr/local/bin/bazel

# Install Buildifier (architecture-aware)
RUN case "${TARGETARCH}" in \
      amd64) BUILDIFIER_ARCH=amd64 ;; \
      arm64) BUILDIFIER_ARCH=arm64 ;; \
      *) echo "Unsupported arch: ${TARGETARCH}"; exit 1 ;; \
    esac && \
    curl -L https://github.com/bazelbuild/buildtools/releases/latest/download/buildifier-linux-${BUILDIFIER_ARCH} -o /usr/local/bin/buildifier \
    && chmod +x /usr/local/bin/buildifier

# Install shfmt (trusted shell formatter, architecture-aware)
RUN case "${TARGETARCH}" in \
      amd64) SHFMT_ARCH=amd64 ;; \
      arm64) SHFMT_ARCH=arm64 ;; \
      *) echo "Unsupported arch: ${TARGETARCH}"; exit 1 ;; \
    esac && \
    curl -L "https://github.com/mvdan/sh/releases/latest/download/shfmt_v3.10.0_linux_${SHFMT_ARCH}" -o /usr/local/bin/shfmt \
    && chmod +x /usr/local/bin/shfmt

# Install kubeconform (Kubernetes 1.30.0 schema validation; architecture-aware)
RUN case "${TARGETARCH}" in \
      amd64) KUBECONFORM_ARCH=amd64 ;; \
      arm64) KUBECONFORM_ARCH=arm64 ;; \
      *) echo "Unsupported arch: ${TARGETARCH}"; exit 1 ;; \
    esac && \
    curl -sL "https://github.com/yannh/kubeconform/releases/download/v0.8.0/kubeconform-linux-${KUBECONFORM_ARCH}.tar.gz" \
      | tar xz -C /usr/local/bin kubeconform \
    && chmod +x /usr/local/bin/kubeconform

# Install additional Python tools for linting + formatting (ruff is the modern trusted choice)
RUN pip3 install --no-cache-dir --break-system-packages \
    ansible-lint \
    mypy \
    yamllint \
    ruff \
    types-PyYAML \
    # Any other project Python deps

# Install Docker CLI (optional, for local k8s testing if needed)
RUN curl -fsSL https://get.docker.com | sh

# Create vscode user if not present (devcontainer base usually has it)
ARG USERNAME=vscode
RUN if ! id -u $USERNAME > /dev/null 2>&1; then \
        useradd -m -s /bin/bash $USERNAME; \
    fi

RUN apt-get update && apt-get install -y --no-install-recommends \
    ripgrep \
    fd-find \
    fzf \
    && rm -rf /var/lib/apt/lists/*

# Post install cleanup
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Default to vscode user
USER vscode
WORKDIR /workspaces/nvidia-dgx-spark-lab

# Helpful message
RUN echo 'echo "Welcome to nvidia-dgx-spark-lab dev container"' >> ~/.bashrc
RUN echo 'echo "Use: bazelisk test //:test   |   make test (legacy parallel)"' >> ~/.bashrc