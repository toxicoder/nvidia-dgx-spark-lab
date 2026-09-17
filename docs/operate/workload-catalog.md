---
title: Workload catalog
description: Every k8s/workloads directory — manage.sh verb, overlay, resource requests from policy, restart/backoff, NCCL, stop, and verify.
tags: [workloads, inference, safety, kubernetes]
---

# Workload catalog

**What's on this page**

- One row per `k8s/workloads/*` directory (and visual overlays)
- Resource **requests** from `config/resource-policy.yaml` (aligned to manifests)
- Verb, overlay, restart/backoff, NCCL, stop, verify

**What this enables**

- Starting the right Job without guessing GPU counts
- Seeing which stacks are mutually exclusive

--8<-- "docs/includes/cluster-config.md"

Numbers below are **requests** (capacity math). Limits may be higher in YAML (e.g. kimi-test limits 16 CPU / 64Gi). Do not invent values — change YAML + policy together. Comparison view: [Models catalog](../models-catalog.md).

Unless noted: `restartPolicy: OnFailure`, `backoffLimit: 1`, namespace `ai-inference`, no auto-start.

Bazel: `bazelisk run //:manage -- <verb>`. Classic: `./scripts/manage.sh <verb>`.

## Inference Jobs

| Id | Verb | Overlay / apply | GPU | Mem | CPU | Heavy | NCCL / topology | Stop | Verify |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| kimi-test | `start-test` | `k8s/overlays/test` | 2 | 32Gi | 8 | no | Works 1-node; pair IFNAME if multi | `stop` | `kubectl get job kimi-test -n {{NAMESPACE}}` |
| kimi | `start-kimi` | `k8s/overlays/prod` | 8 | 128Gi | 32 | yes | High-speed 2+; hostNetwork omitted | `stop` | logs `-l app=kimi` |
| ray-head | `start-ray` | workload dir | 1 | 8Gi | 2 | no | `hostNetwork: true` | `stop` | `ray-head` Job |
| ray-worker | (with `start-ray`) | workload dir | 1 | 8Gi | 2 | no | multi_node_only | `stop` | worker Job on spark1 |
| nemotron-3-ultra | `start-nemotron` | workload dir | 8 | 128Gi | 32 | yes | Ray; hostNetwork | `stop` | after kimi-test |
| nemotron-3-nano-30b | Nemotron stack helpers | workload dir | 1 | 40Gi | 8 | yes | 1-node optimal | stack stop | Job |
| nemotron-3-nano-omni-30b | stack | workload dir | 1 | 45Gi | 8 | yes | 1-node | stack stop | Job |
| nemotron-3-super-120b | stack | workload dir | 1 | 95Gi | 12 | yes | 1–4; hostNetwork omitted | stack stop | Job |
| glm-5.2 | `start-glm` | workload dir + rpc | 1+1 | 110Gi+110Gi | 16+8 | yes | **2-node required**; hostNetwork+hostIPC | `stop` | leader + `glm-5.2-rpc` |
| qwen3.5-122b-a10b-nvfp4 | `start-qwen3.5-122b-nvfp4` | workload dir | 1 | 95Gi | 12 | yes | 1-node | `stop` | Job |
| qwen3.5-397b-spark2 | `start-qwen3.5-397b-spark2` | workload dir | 2 | 220Gi | 16 | yes | 2-node + Ray; hostNetwork | `stop` | Job |
| qwen3.5-397b-nvfp4 | `start-qwen3.5-397b-nvfp4` | leader + 3 workers | 1×4 | 115Gi×4 | 12+8×3 | yes | **4-node**; hostNetwork | `stop` | 4 Jobs |
| qwen3.6-27b-nvfp4 | `start-qwen36-27b` | workload / dual overlay | 1 | 48Gi | 8 | yes | 1-node; dual util 0.38 | `stop` / `stop-qwen36` | [dual stack](../qwen36-dual-stack.md) |
| qwen3.6-35b-a3b-nvfp4 | `start-qwen36-35b-a3b` | rounded pins spark0 | 1 | 48Gi | 8 | yes | 1-node or Mode A | `stop` | Job |
| qwen3.8-flash-next-nvfp4 | `start-qwen38-flash-next` | Mode A spark1 | 1 | 92Gi | 8 | yes | PLE mmap; util 0.82 | Mode A stop | Job |
| medgemma-27b | `start-medgemma` | Mode A spark2 | 1 | 48Gi | 8 | yes | Not a medical device | `stop-medgemma` | Job |
| medgemma-4b | optional sidecar | off by default | 1 | 8Gi | 2 | no | never the only medical model | stop sidecar | Job |
| glm-5.3-flash | `start-glm-5.3-flash` | leader + 2 workers | 1×3 | 100Gi×3 | 12+8+8 | yes | **Mode B ring**; hostNetwork+hostIPC; util 0.85 | `stop-glm53-flash` | refuses A/C |
| deepseek-v4.1-flash | `start-deepseek-v4.1-flash` | leader + 2 workers | 1×3 | 108Gi×3 | 12+8+8 | yes | **Mode C ring**; SGLang 0.95 | `stop-dsv41-flash` | refuses A/B |

Qwen 397B NVFP4 workers and GLM/DeepSeek workers are listed in policy as separate `job_name`s (`stack_with`). The start verb applies the whole stack.

## NIM / aux Deployments (Nemotron)

| Id | GPU | Mem | CPU | Kind | Notes |
| --- | --- | --- | --- | --- | --- |
| nemotron-retriever-embed | 0 | 4Gi | 2 | Deployment | CPU embed |
| nemotron-retriever-rerank | 0 | 6Gi | 2 | Deployment | CPU rerank |
| nemotron-parse | 1 | 8Gi | 4 | Deployment | 2+ node stacks |
| nemotron-safety-guard | 0 | 4Gi | 2 | Deployment | Always-on in stacks |
| nemotron-speech-asr | 0 | 6Gi | 4 | Deployment | CPU |
| nemotron-speech-tts | 0 | 6Gi | 4 | Deployment | CPU |

Presets: [Nemotron agentic stack](../nemotron-agentic-stack.md). These Deployments **do** restart with the controller; they are not 90Gi inference Jobs.

## LiteLLM and rounded Mode A

| Id | Verb | GPU | Mem | CPU | Kind | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| litellm | `start-litellm [--backend …]` | 0 | 1Gi | 500m | Deployment | LAN OpenAI proxy; `Always` OK; `lab-auto` |
| qwen3.8-27b-nvfp4 | `start-qwen38-27b [--with-litellm]` | 1 | 48Gi | 8 | Job | Exclusive util 0.72; refuses B and C |
| rounded-stack | `start-stack-rounded` | 3 nodes | ~189Gi | — | overlay | Mode A; refuses B and C |

`stop-stack-rounded` stops Mode A inference Jobs; LiteLLM can stay. `--quality` uses `rounded-stack-quality` (27B on spark2; `lab-med` falls back).

## Visual (ComfyUI Deployments)

Manual, label `workload: visual`, **one at a time**, exclusive GPU. `stop-visual` keeps PVC `comfy-state`.

| Id | Verb | Mem req | Notes |
| --- | --- | --- | --- |
| comfy-base | `start-comfy-base` | 60Gi | Spark unified-memory patch |
| flux-fast | `start-flux-fast` | 60Gi | Klein 9B NVFP4 + Nunchaku |
| flux-quality | `start-flux-quality` | 70Gi | Dev FP8 |
| ltx-balanced | `start-ltx-balanced` | 70Gi | LTX-2.3 distilled FP8 |
| ltx-quality | `start-ltx-quality` | 80Gi | BF16 distilled |
| flux-to-ltx | `start-flux-to-ltx` | 90Gi | Both families resident |

Single-node Compose sibling: [ez-comfy-stack](https://github.com/toxicoder/ez-comfy-stack). This table is the K3s path: [Visual generative AI](../visual-generative-ai.md).

## Safety (all heavy Jobs)

- Explicit `resources.requests` **and** `limits`
- `restartPolicy: OnFailure` (kimi-test `backoffLimit: 2`; others `1`)
- Heavy confirm + Resource Guard
- Mode A util ≤ 0.82; Mode B ≤ 0.85; Mode C SGLang ≤ 0.95

!!! danger "Do not set restartPolicy Always on large models"

    That would auto-start after reboot and can wedge the host.

## Verify after any start

```bash
bazelisk run //:manage -- status
kubectl get jobs,pods,deploy -n {{NAMESPACE}}
```
