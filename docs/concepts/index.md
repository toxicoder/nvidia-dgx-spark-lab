---
title: Concepts
description: Architecture, NCCL, Resource Guard, model stacks, and glossary for the DGX Spark K3s lab.
tags: [concepts, architecture, safety]
---

# Concepts

**What's on this page**

- Map of explanation pages (Diátaxis “explanation”)
- Where overlay theory and rounded-stack modes live
- Glossary vs in-page abbreviation tooltips

**What this enables**

- Reading “why” before changing playbooks, manifests, or policy
- Distinguishing pair NCCL from the 3-node QSFP ring

| Page | Use it for |
| --- | --- |
| [Architecture](../architecture.md) | Bootstrap → K3s → GPU Operator → Guard → Jobs → dashboard → stacks |
| [Interconnect & NCCL](interconnect-nccl.md) | Ifaces, HCA, pair vs ring, `doctor-fabric` |
| [DGX Spark notes](../dgx-spark-notes.md) | Unified memory, PLE mmap, hostNetwork/hostIPC |
| [Resource Guard](../resource-guard.md) | Headroom floor, util matrix A/B/C, policy twins |
| [Reboot safety](../reboot-safety.md) | Why Jobs do not return after power loss |
| [Models catalog](../models-catalog.md) | Comparison table of every workload directory |
| [Qwen3.6 dual](../qwen36-dual-stack.md) | Time-slicing two 1-GPU Jobs |
| [LiteLLM rounded stack](../litellm-rounded-stack.md) | Mode A / B / C on three nodes |
| [Visual generative AI](../visual-generative-ai.md) | K3s Comfy path; sibling Compose repo |
| [Nemotron agentic stack](../nemotron-agentic-stack.md) | NIM + nano/super presets |
| [Glossary](../glossary.md) | Longer definitions; tooltips from `includes/abbreviations.md` |

Day-2 procedures live under [Operate](../operate/index.md), not here.
