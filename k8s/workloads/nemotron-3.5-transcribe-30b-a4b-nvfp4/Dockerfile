# syntax=docker/dockerfile:1
# Purpose: vLLM serving image for NVIDIA Nemotron 3.5 Transcribe 30B-A4B NVFP4 (GB10 / sm_121)
# Source of truth: nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-NVFP4 model card (vLLM 0.32.0 recipe)
# Regenerate: build on a Blackwell host (DGX Spark); tag nemotron-3.5-transcribe:local
# Safety: NVFP4 needs Blackwell; upstream publishes no container tag, so this pin is ours

# Build on a DGX Spark (aarch64 GB10) or any Blackwell host, from the repo root:
#
#   docker build -t nemotron-3.5-transcribe:local \
#     -f k8s/workloads/nemotron-3.5-transcribe-30b-a4b-nvfp4/Dockerfile .
#
# The model card pins the engine to vLLM 0.32.0 plus the NeMo Speech
# `nemo_speechlm` vLLM plugin. The plugin is not in the upstream vLLM image, so
# installing NeMo Speech from main is what makes `vllm serve` recognise the
# SpeechLM2 architecture and register the CTC timestamp middleware. Keep the
# base tag in lockstep with the model card; bump both together.

ARG VLLM_BASE=vllm/vllm-openai:v0.32.0
FROM ${VLLM_BASE}

# NeMo Speech from main; --break-system-packages keeps the Debian-based image happy.
RUN pip install --no-cache-dir --break-system-packages \
      "git+https://github.com/NVIDIA-NeMo/Speech.git@main"

ENV LAB_NEMOTRON_TRANSCRIBE=1 \
    VLLM_PLUGINS=nemo_speechlm \
    HF_HOME=/models
