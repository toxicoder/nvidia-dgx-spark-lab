# syntax=docker/dockerfile:1
# Purpose: DeepSeek-V4.1-Flash TP=3 SGLang image for 3× DGX Spark (GB10 / sm_121)
# Source of truth: MiaAI-Lab DeepSeek-v4.1-Flash-DGX-Sparks overlay (AGPL-3.0)
# Regenerate: build on aarch64 Spark; tag dsv41-flash-tp3:local
# Safety: stock lmsysorg/sglang cannot pad TP=3 / Engram-on-NVMe / b12x MXFP8

# Build on a DGX Spark node (aarch64, sm_121). This thin wrapper does not
# replace the published overlay — follow
# https://github.com/MiaAI-Lab/DeepSeek-v4.1-Flash-DGX-Sparks
# (AGPL-3.0; do not vendor adapter/ into this repo) and tag the result:
#
#   docker build -t dsv41-flash-tp3:local -f k8s/workloads/deepseek-v4.1-flash/Dockerfile .
#
# Then copy the image to spark1 and spark2 so all three ranks share the same ID.
#
# This Dockerfile is a documented pin for the Job image name. Replace the FROM
# line with the recipe's patched tag after you build it on-cluster.
# PYTORCH_CUDA_ALLOC_CONF must stay expandable_segments:False (True NaNs V4.1
# prompts longer than 64 tokens). Do not copy the Comfy visual True patch.

ARG SGLANG_BASE=lmsysorg/sglang:dev-dsv41
FROM ${SGLANG_BASE}

ENV LAB_DSV41_TP3=1 \
    CUTE_DSL_ARCH=sm_121a \
    TORCH_CUDA_ARCH_LIST=12.1a \
    PYTORCH_CUDA_ALLOC_CONF=expandable_segments:False
