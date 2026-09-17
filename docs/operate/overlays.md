---
title: Kustomize overlays
description: test, prod, single-node, rounded-stack, and rounded-stack-quality — what each overlay points at and when to use it.
tags: [kustomize, overlays, kubernetes, safety]
---

# Kustomize overlays

**What's on this page**

- Overlay matrix under `k8s/overlays/`
- Which workload directories each overlay includes
- How `manage.sh` relates (most starts target workload dirs, not overlay names)

**What this enables**

- Choosing test vs prod vs single-node without editing base Jobs
- Understanding Mode A rounded overlays vs exclusive Mode B/C workload dirs

--8<-- "docs/includes/cluster-config.md"

## Matrix

| Overlay | Resources | Patches | When |
| --- | --- | --- | --- |
| `test` | `k8s/workloads/kimi-test` | `patches/test-resources.yaml` (lighter) | Smoke the stack without production kimi |
| `prod` | `k8s/workloads/kimi` | none today | Stable entry for full kimi; values live in the workload YAML |
| `single-node` | `kimi-test` | `single-node-tensor-parallel.yaml` — TP 2→1, GPU 2→1 | One Spark validation |
| `single-node/qwen36-dual` | Qwen3.6 dual | dual-memory patch | 1-node concurrent 27B + 35B-A3B |
| `test/qwen36-dual` | Qwen3.6 dual | test-resources | Lighter dual |
| `rounded-stack` | 35B-A3B + Flash-Next + MedGemma 27B + LiteLLM | pin 35B to spark0 | Mode A daily 3-node fleet |
| `rounded-stack-quality` | 35B-A3B + Flash-Next + **27B** + LiteLLM | pin 35B spark0, 27B spark2 | Mode A `--quality`; `lab-med` falls back |
| `litellm-qwen38-27b` | LiteLLM Deployment + Qwen3.8-27B profile | replace ConfigMap | `start-qwen38-27b --with-litellm` |
| `litellm-qwen38-flash-next` | LiteLLM + Flash-Next profile | replace ConfigMap | `start-qwen38-flash-next --with-litellm` |
| `litellm-glm53-flash` | LiteLLM + GLM profile | replace ConfigMap | `start-glm53-flash --with-litellm` |
| `litellm-dsv41-flash` | LiteLLM + DeepSeek-V4.1-Flash profile | replace ConfigMap | `start-dsv41-flash --with-litellm` |

Inspect:

```bash
kubectl kustomize k8s/overlays/test
kubectl kustomize k8s/overlays/prod
kubectl kustomize k8s/overlays/single-node
kubectl kustomize k8s/overlays/rounded-stack
```

## Theory

Base workloads under `k8s/workloads/<id>/` are the source of truth for CPU/GPU/memory, `restartPolicy`, `backoffLimit`, and NCCL. Overlays **select** and optionally **patch**. Prod has no patches on purpose: production numbers stay auditable in `kimi-job.yaml`.

`manage.sh start-test` applies the test/kimi-test path. `start-kimi` applies production kimi. `start-stack-rounded` applies the rounded overlay. Exclusive Mode B/C are **workload directories** (`glm-5.3-flash`, `deepseek-v4.1-flash`), not the rounded overlay.

!!! warning "Exclusive modes"

    Rounded overlay (Mode A) is mutually exclusive with GLM-5.3-Flash and DeepSeek-V4.1-Flash starts. The CLI refuses collisions.

## Verify

```bash
bazelisk run //:manage -- status
kubectl get jobs,deploy,svc -n {{NAMESPACE}}
```
