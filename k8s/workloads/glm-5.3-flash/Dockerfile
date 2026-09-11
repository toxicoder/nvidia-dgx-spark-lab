# syntax=docker/dockerfile:1
# Purpose: GLM-5.3-Flash TP=3 serving image for 3× DGX Spark (GB10 / sm_121)
# Source of truth: published NNNtrance / local-inference-lab Spark TP=3 recipe
# Regenerate: build on aarch64 Spark; tag glm53-flash-tp3:local
# Safety: stock vllm/vllm-openai:cu130-nightly cannot run TP=3 (64 heads / MoE width)

# Build on a DGX Spark node (aarch64, sm_121). Do not expect this thin wrapper
# to replace the published overlay patches — follow
# https://github.com/NNNtrance/GLM-5.3-Flash-NVFP4-TP3-3x-DGX-Spark
# docs/02-image-build.md (or local-inference-lab equivalent) and tag the result:
#
#   docker build -t glm53-flash-tp3:local -f k8s/workloads/glm-5.3-flash/Dockerfile .
#
# Then copy the image to spark1 and spark2 so all three ranks share the same ID.
#
# This Dockerfile is a documented pin for the Job image name. Replace the FROM
# line with the recipe's patched tag after you build it on-cluster.

ARG VLLM_BASE=vllm/vllm-openai:cu130-nightly
FROM ${VLLM_BASE}

ENV LAB_GLM53_TP3=1 \
    CUTE_DSL_ARCH=sm_121a \
    TORCH_CUDA_ARCH_LIST=12.1a
