# syntax=docker/dockerfile:1
# ## Contributor dev image for nvidia-dgx-spark-lab
#
# Purpose: Multi-arch Linux contributor image (linux/amd64 + linux/arm64).
# Source of truth: .devcontainer/tool-versions.env (pins + checksums).
# Regenerate: docker buildx bake -f .devcontainer/docker-bake.hcl
# Safety: no secrets; Grok binary is unsigned-input verified by sha256.
#
# Hosts: macOS (Apple Silicon / Intel), Windows + WSL2, Linux, DGX Spark
# (Grace ARM), GitHub Codespaces. The container is always Linux; we do not
# ship Windows containers (Bazel / kcov / kubeconform are Linux-native).
#
# Layering: each CLI is an independent fetch stage so bumping one pin does
# not re-download the others. Version ARGs live in the stage that uses them
# (an ARG invalidates every later instruction in that stage only).
#
# Docker engine: docker-outside-of-docker Feature (host socket), not here.
#
# Build context: .devcontainer/ (see devcontainer.json).

# ---------------------------------------------------------------------------
# Fetch stages (BuildKit builds these in parallel; caches are independent)
# ---------------------------------------------------------------------------
FROM alpine:3.21 AS fetch-base
RUN apk add --no-cache curl ca-certificates tar gzip xz

FROM fetch-base AS kubectl
ARG TARGETARCH
ARG KUBECTL_VERSION=v1.30.14
ARG KUBECTL_SHA256_AMD64=7ccac981ece0098284d8961973295f5124d78eab7b89ba5023f35591baa16271
ARG KUBECTL_SHA256_ARM64=a32e46ae15fe41292dc6a7cd76beba7104282a5a3fa9e3686319000a537f4f5d
RUN mkdir -p /out \
 && case "${TARGETARCH}" in \
      amd64) sha="${KUBECTL_SHA256_AMD64}" ;; \
      arm64) sha="${KUBECTL_SHA256_ARM64}" ;; \
      *) echo "Unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac \
 && curl -fsSL "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${TARGETARCH}/kubectl" -o /out/kubectl \
 && echo "${sha}  /out/kubectl" | sha256sum -c \
 && chmod +x /out/kubectl

FROM fetch-base AS helm
ARG TARGETARCH
ARG HELM_VERSION=v3.15.0
ARG HELM_SHA256_AMD64=a74747ac40777b86d3ff6f1be201504bba65ca46cd68b5fe25d3c394d0dcf745
ARG HELM_SHA256_ARM64=c3b0281fca4c030548211dd6e9b032ee0a9fc53eab614f6acbaff631682ce808
RUN mkdir -p /out \
 && case "${TARGETARCH}" in \
      amd64) sha="${HELM_SHA256_AMD64}" ;; \
      arm64) sha="${HELM_SHA256_ARM64}" ;; \
      *) echo "Unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac \
 && curl -fsSL "https://get.helm.sh/helm-${HELM_VERSION}-linux-${TARGETARCH}.tar.gz" -o /tmp/helm.tgz \
 && echo "${sha}  /tmp/helm.tgz" | sha256sum -c \
 && tar -xzf /tmp/helm.tgz -C /tmp \
 && install "/tmp/linux-${TARGETARCH}/helm" /out/helm

FROM fetch-base AS bazelisk
ARG TARGETARCH
ARG BAZELISK_VERSION=v1.25.0
ARG BAZELISK_SHA256_AMD64=fd8fdff418a1758887520fa42da7e6ae39aefc788cf5e7f7bb8db6934d279fc4
ARG BAZELISK_SHA256_ARM64=4c8d966e40ac2c4efcc7f1a5a5cceef2c0a2f16b957e791fa7a867cce31e8fcb
RUN mkdir -p /out \
 && case "${TARGETARCH}" in \
      amd64) sha="${BAZELISK_SHA256_AMD64}" ;; \
      arm64) sha="${BAZELISK_SHA256_ARM64}" ;; \
      *) echo "Unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac \
 && curl -fsSL "https://github.com/bazelbuild/bazelisk/releases/download/${BAZELISK_VERSION}/bazelisk-linux-${TARGETARCH}" -o /out/bazelisk \
 && echo "${sha}  /out/bazelisk" | sha256sum -c \
 && chmod +x /out/bazelisk

FROM fetch-base AS buildifier
ARG TARGETARCH
ARG BUILDIFIER_VERSION=v8.2.1
ARG BUILDIFIER_SHA256_AMD64=6ceb7b0ab7cf66fceccc56a027d21d9cc557a7f34af37d2101edb56b92fcfa1a
ARG BUILDIFIER_SHA256_ARM64=3baa1cf7eb41d51f462fdd1fff3a6a4d81d757275d05b2dd5f48671284e9a1a5
RUN mkdir -p /out \
 && case "${TARGETARCH}" in \
      amd64) sha="${BUILDIFIER_SHA256_AMD64}" ;; \
      arm64) sha="${BUILDIFIER_SHA256_ARM64}" ;; \
      *) echo "Unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac \
 && curl -fsSL "https://github.com/bazelbuild/buildtools/releases/download/${BUILDIFIER_VERSION}/buildifier-linux-${TARGETARCH}" -o /out/buildifier \
 && echo "${sha}  /out/buildifier" | sha256sum -c \
 && chmod +x /out/buildifier

FROM fetch-base AS shfmt
ARG TARGETARCH
ARG SHFMT_ASSET_VERSION=3.10.0
ARG SHFMT_SHA256_AMD64=1f57a384d59542f8fac5f503da1f3ea44242f46dff969569e80b524d64b71dbc
ARG SHFMT_SHA256_ARM64=9d23013d56640e228732fd2a04a9ede0ab46bc2d764bf22a4a35fb1b14d707a8
RUN mkdir -p /out \
 && case "${TARGETARCH}" in \
      amd64) sha="${SHFMT_SHA256_AMD64}" ;; \
      arm64) sha="${SHFMT_SHA256_ARM64}" ;; \
      *) echo "Unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac \
 && curl -fsSL "https://github.com/mvdan/sh/releases/download/v${SHFMT_ASSET_VERSION}/shfmt_v${SHFMT_ASSET_VERSION}_linux_${TARGETARCH}" -o /out/shfmt \
 && echo "${sha}  /out/shfmt" | sha256sum -c \
 && chmod +x /out/shfmt

FROM fetch-base AS kubeconform
ARG TARGETARCH
ARG KUBECONFORM_VERSION=v0.8.0
ARG KUBECONFORM_SHA256_AMD64=9bc2bffbf71f261128533edaf912153948b7ff238f9a531ae6d34466ec287883
ARG KUBECONFORM_SHA256_ARM64=1f53fc8e81258197a35e8603054162a5af1de8c5af13746c71ab680d9534ed87
RUN mkdir -p /out \
 && case "${TARGETARCH}" in \
      amd64) sha="${KUBECONFORM_SHA256_AMD64}" ;; \
      arm64) sha="${KUBECONFORM_SHA256_ARM64}" ;; \
      *) echo "Unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac \
 && curl -fsSL "https://github.com/yannh/kubeconform/releases/download/${KUBECONFORM_VERSION}/kubeconform-linux-${TARGETARCH}.tar.gz" -o /tmp/kubeconform.tgz \
 && echo "${sha}  /tmp/kubeconform.tgz" | sha256sum -c \
 && tar -xzf /tmp/kubeconform.tgz -C /out kubeconform \
 && chmod +x /out/kubeconform

FROM fetch-base AS node
ARG TARGETARCH
ARG NODE_VERSION=22.23.2
ARG NODE_SHA256_AMD64=d60acfe00a2932254bb0ad20e01b0d74397a0875595de719654b214f4b03f307
ARG NODE_SHA256_ARM64=fff4078c5def658577f92c88db7db3bc0072924bfb93fe52c1e744a54e94abb8
RUN mkdir -p /out \
 && case "${TARGETARCH}" in \
      amd64) narch=x64; sha="${NODE_SHA256_AMD64}" ;; \
      arm64) narch=arm64; sha="${NODE_SHA256_ARM64}" ;; \
      *) echo "Unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac \
 && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${narch}.tar.xz" -o /tmp/node.tar.xz \
 && echo "${sha}  /tmp/node.tar.xz" | sha256sum -c \
 && tar -xJf /tmp/node.tar.xz -C /out --strip-components=1

# Grok Build CLI (~130–155 MiB). Own stage so a Grok bump does not refetch Node.
FROM fetch-base AS grok
ARG TARGETARCH
ARG GROK_VERSION=1.0.34
ARG GROK_SHA256_AMD64=be5905e107d2b8b5f3c142d21ecfe4c8fd32a913d2fd551b788707930c4dc80d
ARG GROK_SHA256_ARM64=39ab87666877d64ef3a40aa60fbe0c3b6a6acd7001b78fe60e2c76bb6cfc4a94
RUN mkdir -p /out \
 && case "${TARGETARCH}" in \
      amd64) garch=x86_64; sha="${GROK_SHA256_AMD64}" ;; \
      arm64) garch=aarch64; sha="${GROK_SHA256_ARM64}" ;; \
      *) echo "Unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac \
 && curl -fsSL "https://x.ai/cli/grok-${GROK_VERSION}-linux-${garch}" -o /out/grok \
 && echo "${sha}  /out/grok" | sha256sum -c \
 && chmod +x /out/grok

# ---------------------------------------------------------------------------
# Final image
# ---------------------------------------------------------------------------
# Jammy (not bookworm): stock pip has no PEP 668, so we can pip-install tools
# without --break-system-packages. Landlock is the *host* kernel regardless.
FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# Injected by BuildKit from --platform / host arch (amd64|arm64). Do not
# hardcode a default — ARG TARGETARCH=amd64 incorrectly pulls amd64 binaries
# on Apple Silicon and DGX Spark (Grace arm64).
ARG TARGETARCH
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    GROK_BIN_DIR=/usr/local/bin \
    GROK_DISABLE_AUTOUPDATER=1

# Ubuntu /bin/sh is dash; pipefail and other bashisms need bash for RUN layers.
SHELL ["/bin/bash", "-euo", "pipefail", "-c"]

# Keep downloaded .debs in the cache mount across rebuilds of this layer.
RUN rm -f /etc/apt/apt.conf.d/docker-clean \
 && echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' \
      >/etc/apt/apt.conf.d/keep-cache

# Single apt layer: base CLIs used by //:lint, BATS, docs, and k8s smoke paths.
# bubblewrap is required for Grok sandbox deny lists on Linux (fail-closed).
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    apt-transport-https \
    bats \
    bubblewrap \
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
    software-properties-common \
    unzip \
    wget \
    xz-utils \
    yamllint \
    && (command -v fdfind >/dev/null && ln -sf "$(command -v fdfind)" /usr/local/bin/fd || true)

# Python 3.11 (IDE + ruff/mypy) via deadsnakes. Separate layer from apt so a
# PYTHON_VERSION bump does not rebuild shellcheck/git/kcov.
ARG PYTHON_VERSION=3.11
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    add-apt-repository -y ppa:deadsnakes/ppa \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      "python${PYTHON_VERSION}" \
      "python${PYTHON_VERSION}-dev" \
      "python${PYTHON_VERSION}-venv" \
 && mkdir -p /usr/local/python/current/bin \
 && ln -sfn "/usr/bin/python${PYTHON_VERSION}" /usr/local/python/current/bin/python \
 && ln -sfn "/usr/bin/python${PYTHON_VERSION}" /usr/local/python/current/bin/python3 \
 && ln -sfn "/usr/bin/python${PYTHON_VERSION}" "/usr/local/bin/python${PYTHON_VERSION}" \
 && "/usr/bin/python${PYTHON_VERSION}" -m ensurepip --upgrade

COPY --from=kubectl /out/kubectl /usr/local/bin/kubectl
COPY --from=helm /out/helm /usr/local/bin/helm
COPY --from=bazelisk /out/bazelisk /usr/local/bin/bazelisk
COPY --from=buildifier /out/buildifier /usr/local/bin/buildifier
COPY --from=shfmt /out/shfmt /usr/local/bin/shfmt
COPY --from=kubeconform /out/kubeconform /usr/local/bin/kubeconform

RUN ln -sf /usr/local/bin/bazelisk /usr/local/bin/bazel \
 && kubectl version --client \
 && helm version \
 && bazelisk version \
 && shfmt --version \
 && kubeconform -v \
 && buildifier --version || true

# Python lint/test/docs helpers. Jammy pip (and deadsnakes 3.11 ensurepip)
# accept a system install without --break-system-packages.
RUN --mount=type=cache,target=/root/.cache/pip \
    /usr/local/python/current/bin/python -m pip install \
    "ansible>=2.14" \
    ansible-lint \
    mypy \
    pre-commit \
    pytest \
    pytest-cov \
    ruff \
    types-PyYAML \
    yamllint

COPY --from=node /out /usr/local/lib/node
RUN ln -sfn /usr/local/lib/node/bin/node /usr/local/bin/node \
 && ln -sfn /usr/local/lib/node/bin/npm /usr/local/bin/npm \
 && ln -sfn /usr/local/lib/node/bin/npx /usr/local/bin/npx \
 && node --version \
 && npm --version

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
                /usr/local/share/dgx-lab/grok \
                /etc/grok \
    && chown -R ${USERNAME}:${USERNAME} /home/${USERNAME}

# Grok last among CLIs: the binary is large and the pin moves more often.
COPY --from=grok /out/grok /usr/local/bin/grok
RUN ln -sfn /usr/local/bin/grok /usr/local/bin/agent \
 && /usr/local/bin/grok --version

COPY grok-managed.toml /etc/grok/managed_config.toml
COPY sandbox.toml /usr/local/share/dgx-lab/grok/sandbox.toml
COPY host-llm.example.toml /usr/local/share/dgx-lab/grok/host-llm.example.toml

# Welcome banner (linux container; host can be macOS/Windows/Spark).
USER ${USERNAME}
RUN printf '%s\n' \
  'echo "nvidia-dgx-spark-lab dev container ($(uname -m))"' \
  'echo "  doctor:  bash .devcontainer/doctor.sh"' \
  'echo "  fix:     bazelisk run //:fix"' \
  'echo "  validate: bazelisk run //:validate"' \
  'echo "  grok:    grok login --device-auth   # host LLM: host.docker.internal"' \
  'echo "  docs:    bazelisk run //docs:serve -- --port 8080"' \
  >> ~/.bashrc

# Do not hardcode WORKDIR to a fixed clone path — Dev Containers set workspaceFolder.
WORKDIR /workspaces
