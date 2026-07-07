# Spark Lab Coder workspace image — dev tools + Hermes client wiring.
# Build from repo root:
#   docker build -t spark-lab-coder-workspace:latest -f k8s/dev/images/coder-workspace/Dockerfile .

FROM codercom/enterprise-base:ubuntu

ARG TARGETARCH=amd64
ENV DEBIAN_FRONTEND=noninteractive

USER root

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
    yamllint \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ripgrep \
    fd-find \
    fzf \
    && rm -rf /var/lib/apt/lists/*

RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/${TARGETARCH}/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

RUN curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 \
    && chmod +x get_helm.sh \
    && ./get_helm.sh --version v3.15.0 \
    && rm get_helm.sh

RUN case "${TARGETARCH}" in \
      amd64) BAZEL_ARCH=amd64; BUILDIFIER_ARCH=amd64; SHFMT_ARCH=amd64; KUBECONFORM_ARCH=amd64 ;; \
      arm64) BAZEL_ARCH=arm64; BUILDIFIER_ARCH=arm64; SHFMT_ARCH=arm64; KUBECONFORM_ARCH=arm64 ;; \
      *) echo "Unsupported arch: ${TARGETARCH}"; exit 1 ;; \
    esac && \
    curl -L "https://github.com/bazelbuild/bazelisk/releases/latest/download/bazelisk-linux-${BAZEL_ARCH}" -o /usr/local/bin/bazelisk \
    && chmod +x /usr/local/bin/bazelisk \
    && ln -sf /usr/local/bin/bazelisk /usr/local/bin/bazel \
    && curl -L "https://github.com/bazelbuild/buildtools/releases/latest/download/buildifier-linux-${BUILDIFIER_ARCH}" -o /usr/local/bin/buildifier \
    && chmod +x /usr/local/bin/buildifier \
    && curl -L "https://github.com/mvdan/sh/releases/latest/download/shfmt_v3.10.0_linux_${SHFMT_ARCH}" -o /usr/local/bin/shfmt \
    && chmod +x /usr/local/bin/shfmt \
    && curl -sL "https://github.com/yannh/kubeconform/releases/download/v0.8.0/kubeconform-linux-${KUBECONFORM_ARCH}.tar.gz" \
      | tar xz -C /usr/local/bin kubeconform \
    && chmod +x /usr/local/bin/kubeconform

RUN pip3 install --no-cache-dir --break-system-packages \
    ansible-lint \
    yamllint \
    ruff

COPY k8s/dev/images/coder-workspace/workspace-init.sh /usr/local/bin/workspace-init.sh
RUN chmod +x /usr/local/bin/workspace-init.sh

COPY mcp/config/clients/coder-workspace.mcp.json.example /etc/spark-lab/coder-workspace.mcp.json.example

USER coder
WORKDIR /home/coder

RUN echo 'echo "Spark Lab Coder workspace — Hermes dev assistant at http://127.0.0.1:9119"' >> ~/.bashrc