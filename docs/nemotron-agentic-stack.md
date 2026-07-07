---
title: Nemotron Agentic Stack
description: One-click Nemotron agentic stack presets for 1–4 DGX Spark nodes — models, pillars, capacity, and endpoints.
tags: [nemotron, inference, agents, safety, rag]
---

# Nemotron Agentic Stack

**What's on this page**

- Full agentic stack presets for 1–4 DGX Spark nodes
- Model catalog (Nano, Super, Omni, Retriever, Parse, Safety, Speech)
- Cluster-size feasibility and excluded tiers (Ultra on small clusters)
- Dashboard deploy flow and OpenAI-compatible endpoints

**What this enables**

- Deploying a complete Nemotron agentic pipeline (reasoning + RAG + safety) in one click
- Picking the right preset for your node count without manual manifest juggling
- Copying per-service API URLs for LangGraph, OpenAI SDK, or custom agents

## Presets

| Preset ID | Nodes | Orchestrator | Pillars |
|-----------|-------|--------------|---------|
| `nemotron-agentic-spark-1` | 1 | Nano Omni NVFP4 | orchestrator, document, RAG, safety |
| `nemotron-agentic-spark-1-reasoning` | 1 | Nano 30B + Parse | text-first full stack |
| `nemotron-agentic-spark-2-agent` | 2 | Dual Nano + Omni | best long agent loops |
| `nemotron-agentic-spark-2-reasoning` | 2 | Super + Nano | hard reasoning + tool caller |
| `nemotron-agentic-spark-3` | 3 | Super + Nano + Omni | + Speech ASR |
| `nemotron-agentic-spark-4` | 4 | Full suite | + Speech TTS |

### Qwen 3.5 tier stacks (same pillars, smaller substitutes)

When the frontier NVFP4 397B checkpoint does not fit, deploy parallel Qwen presets with substituted orchestrators:

| Preset ID | Nodes | Orchestrator | Notes |
|-----------|-------|--------------|-------|
| `qwen-agentic-spark-1` | 1 | Qwen 122B NVFP4 | ~75 GB; substitute for 397B NVFP4 |
| `qwen-agentic-spark-2` | 2 | Qwen 397B int4-AutoRound | Full 397B; ~26–30 tok/s on dual Spark |
| `qwen-agentic-spark-4` | 4 | Qwen 397B NVFP4 | Exact `nvidia/Qwen3.5-397B-A17B-NVFP4` |

All Qwen presets share CPU RAG (`nemotron-retriever-*`) and safety guard with Nemotron stacks.

## Deploy from dashboard

1. Open **Inference Workloads** → **Nemotron Agentic Stack** card.
2. Confirm cluster size badge matches your nodes.
3. On 2-node clusters, pick **Dual Nano** (agents) or **Super + Nano** (reasoning).
4. Click **Deploy full stack** — Resource Guard and heavy confirm gates apply.
5. Copy endpoints from the hub when all components are healthy.

## CLI

```bash
bazelisk run //scripts:run-utility -- nemotron-stack catalog
bazelisk run //scripts:run-utility -- nemotron-stack check --action stack:nemotron-agentic-spark-1
bazelisk run //scripts:run-utility -- nemotron-stack start nemotron-agentic-spark-1 --confirm yes
bazelisk run //scripts:run-utility -- nemotron-stack stop nemotron-agentic-spark-1
```

## Frontier models on Spark (Qwen 397B NVFP4)

The exact NVFP4 397B checkpoint (~250 GB) requires **4 nodes**. On smaller clusters, use `qwen-agentic-spark-1` (122B NVFP4) or `qwen-agentic-spark-2` (397B int4-AutoRound) — see `qwen_tiers` in `config/nemotron-catalog.yaml`.

Nemotron Ultra 550B is not in default presets. Community paths exist (2-node GGUF-RPC, 4-node SGLang NVFP4) but require experimental toggles and displace other workloads.

## Safety

- All LLM jobs use `restartPolicy: OnFailure` and `backoffLimit: 1`.
- Stack capacity checks sum every component before any `kubectl apply`.
- Conservative `gpu-memory-utilization` (0.55–0.65) on 1–2 node presets preserves unified-memory headroom for agent tooling.

## Related

- [models-catalog.md](models-catalog.md)
- [hermes-agent.md](hermes-agent.md)
- `config/nemotron-catalog.yaml`
- `config/resource-policy.yaml` (`stacks` section)