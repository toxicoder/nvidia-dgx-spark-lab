---
title: nvidia-dgx-spark-lab
description: Practical, production-oriented lab for running large AI inference workloads on 1-4 NVIDIA DGX Spark nodes (scalable) with K3s and NVIDIA GPU Operator.
tags: [bazel, kubernetes, ansible, nvidia, dgx, inference]
---

# nvidia-dgx-spark-lab

**What's on this page**

- Project goals and core safety principles
- Node role table (1-node vs 2-4 node configurations)
- Core components (K3s, GPU Operator, Ansible + cloud-init, Helm vs raw manifests)
- High-speed interconnect and NCCL configuration
- High-level repository layout
- Links to getting started and other sections

**What this enables**

- Quickly understanding the lab's scope (small 1-4 node DGX Spark clusters for large inference)
- Seeing the emphasis on stability, explicit resources, and no auto-start of heavy jobs
- Deciding where to go next (Getting Started guide is the primary entry point)

## Goals

- Run very large models (e.g. Kimi-K2.6 and similar) reliably without freezing the host or making SSH unresponsive.
- Utilize the dual 400G high-speed interconnect between nodes.
- Provide both a heavy production configuration and a lighter/safer test mode.
- Never auto-start heavy containers on reboot.
- Everything managed through simple, auditable scripts and manifests.

See the sections on the left (or top tabs) to get started.

**Start here**: the [Getting Started](getting-started.md) guide is now a hyper-detailed, end-to-end walkthrough with numbered steps, verification commands after each action, 1-node vs multi-node tabs, safety warnings, Bazel-first examples, and direct integration of the auto-generated command reference (powered by `generate_shell_docs.py` from comments in `scripts/` — refreshed via `bazelisk run //docs:docs`).

This documentation site is built with [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/).
