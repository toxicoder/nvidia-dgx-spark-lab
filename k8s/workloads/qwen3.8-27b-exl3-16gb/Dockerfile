# syntax=docker/dockerfile:1
# Purpose: ExLlamaV3 serving image for Qwen3.8-27B EXL3 on 16 GB+ consumer NVIDIA GPUs
# Source of truth: MiaAI-Lab/Qwen3.8-27B-16gb-NVIDIA-GPUs-one-click-install (venv kit, no official image)
# Regenerate: docker build -t qwen38-27b-exl3:local -f k8s/workloads/qwen3.8-27b-exl3-16gb/Dockerfile .
# Safety: pins ExLlamaV3 1.6.0 + torch cu128; runs as UID 1000; no model weights baked in

# Upstream ships no container: it is a Windows/Linux venv kit. This Dockerfile is the
# k8s pin for that kit - ExLlamaV3 v1.6.0 (turboderp-org/exllamav3) from prebuilt
# wheels, PyTorch from the cu128 index (matches the driver 570+ / CUDA 12.8 stack).
#
# Build on the GPU node itself (or any amd64/arm64 host with the target CUDA driver)
# and keep the tag local; the Job pulls with imagePullPolicy: IfNotPresent.

ARG CUDA_BASE=nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04
FROM ${CUDA_BASE}

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    VIRTUAL_ENV=/opt/exllamav3 \
    PATH=/opt/exllamav3/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    HF_HOME=/models

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        libgomp1 \
        python3.12 \
        python3.12-venv \
    && rm -rf /var/lib/apt/lists/* \
    && python3.12 -m venv "${VIRTUAL_ENV}" \
    && pip install --upgrade pip

# torch first from the cu128 wheel index so the ExLlamaV3 prebuilt wheels resolve
# against the same CUDA minor; --extra-index-url keeps PyPI available for deps.
RUN pip install --index-url https://download.pytorch.org/whl/cu128 torch \
    && pip install --extra-index-url https://download.pytorch.org/whl/cu128 \
        exllamav3==1.6.0

USER 1000
WORKDIR /models

# Kept minimal on purpose: the Job supplies the real serve args
# (--model_dir/--host/--port/--ctx_size/--max_parallel/--gpu_mem_gb).
CMD ["python", "-m", "exllamav3_server", "--help"]
