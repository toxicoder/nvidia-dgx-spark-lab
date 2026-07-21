---
title: Glossary
description: Lab terminology with short definitions and links to deeper concept pages — educational companion to in-page tooltips.
tags: [glossary, concepts, education]
---

# Glossary

**What's on this page**

- Short definitions of lab-specific and Kubernetes / GPU terms
- Links to concept and how-to pages for deeper reading
- How in-page tooltips relate to this glossary

**What this enables**

- Scanning jargon without leaving educational guides
- Diving deeper when a tooltip is not enough
- Consistent language across docs, scripts, and the dashboard

Hover any dotted abbreviation in the docs (for example K3s or Resource Guard) for a quick tooltip. Those tooltips are generated from `docs/includes/abbreviations.md`. This page expands the same vocabulary with context and links.

## Core lab concepts

| Term | Definition | Learn more |
| --- | --- | --- |
| **Resource Guard** | Capacity gate that estimates free GPU/CPU/memory and blocks heavy starts when headroom is insufficient. | [Resource Guard](resource-guard.md) |
| **headroom** | Free capacity kept reserved so SSH, K3s, and the dashboard stay responsive under load. | [Resource Guard](resource-guard.md), [Reboot safety](reboot-safety.md) |
| **restartPolicy** | How Kubernetes restarts Job pods. Heavy inference uses `OnFailure` or `Never` with a low **backoffLimit** (never `Always`). | [Reboot safety](reboot-safety.md) |
| **manage.sh** | Primary operator CLI for status, start/stop workloads, SSO, monitoring, and utilities (Bazel: `//:manage`). | [Getting started](getting-started.md), [Shell reference](generated/shell/reference.md) |

## Cluster & platform

| Term | Definition | Learn more |
| --- | --- | --- |
| **K3s** | Lightweight Kubernetes used as the lab control plane. | [Architecture](architecture.md) |
| **GPU Operator** | NVIDIA components for drivers, device plugin, and MIG on the cluster. | [Architecture](architecture.md) |
| **Ansible** | Idempotent bootstrap for OS prep, K3s, GPU Operator, and apps. | [Getting started](getting-started.md) |
| **cloud-init** | First-boot OS configuration (users, network, packages) before Ansible. | [Getting started](getting-started.md) |
| **Traefik** | Ingress / reverse proxy in front of lab services. | [SSO](sso.md) |
| **Authelia** | Authentication portal used with Traefik for SSO. | [SSO](sso.md) |

## Workloads & parallelism

| Term | Definition | Learn more |
| --- | --- | --- |
| **Job** | Run-to-completion Kubernetes workload (typical for heavy model starts). | [Architecture](architecture.md) |
| **Deployment** | Long-running replica set (dashboard, ComfyUI, gateways). | [Visual generative AI](visual-generative-ai.md) |
| **NCCL** | Collective communications for multi-GPU / multi-node; lab multi-node jobs set high-speed `NCCL_*` env. | [DGX Spark notes](dgx-spark-notes.md) |
| **tensor parallel** | Shard model layers across GPUs to fit large models. | [Models catalog](models-catalog.md) |
| **unified memory** | Single memory pool shared by CPU and GPU on DGX Spark (Grace + Blackwell). | [DGX Spark notes](dgx-spark-notes.md) |
| **MIG** | Multi-Instance GPU partitioning (when enabled on supporting GPUs). | [Resource Guard](resource-guard.md) |

## Storage & config

| Term | Definition | Learn more |
| --- | --- | --- |
| **PVC** | PersistentVolumeClaim for durable pod storage (e.g. Comfy state). | [Visual generative AI](visual-generative-ai.md) |
| **hostPath** | Mount of a path on the node (e.g. `/mnt/models` for model weights). | [Models catalog](models-catalog.md) |
| **kustomize** | Overlay-based Kubernetes config (base + test/prod/single-node). | [Architecture](architecture.md) |

## Agents & UI

| Term | Definition | Learn more |
| --- | --- | --- |
| **Hermes** | Docker agent stack with gateway and tools. | [Hermes Agent](hermes-agent.md) |
| **MCP** | Model Context Protocol for tool servers agents can call. | [MCP Agent Toolkit](mcp-agent-toolkit.md) |
| **Open WebUI** | Chat UI fronting OpenAI-compatible backends. | [Open WebUI](open-webui.md) |
| **ComfyUI** | Node graph UI for visual generative AI (FLUX / LTX). | [Visual generative AI](visual-generative-ai.md) |

## Tooling

| Term | Definition | Learn more |
| --- | --- | --- |
| **Bazel** / **Bazelisk** | Hermetic builds, tests, and docs entry points (`bazelisk run //:validate`). | [Building with Bazel](BUILDING_WITH_BAZEL.md) |
| **MkDocs** / **Material** | Documentation generator and theme for this site. | [Contributing to docs](CONTRIBUTING.md) |

## Maintaining the glossary

1. Add a short tooltip line to `docs/includes/abbreviations.md` (`*[Term]: …`).
2. Add or update a row on this page with a deeper link.
3. Prefer linking to existing concept pages over duplicating long guides here.

In-page tooltips use Material **content.tooltips** + the `abbr` Markdown extension.
