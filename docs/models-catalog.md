---
title: Models & Resource Catalog
description: Comparison table and detailed profiles for kimi-test, kimi, ray, nemotron, and glm workloads — resource estimator usage and safety guidance.
tags: [models, inference, safety, resources, vllm]
---

# Models & Resource Catalog

**What's on this page**

- Quick comparison table of models (GPUs, memory, purpose, safety notes, NCCL needs)
- Detailed profiles for kimi-test, kimi, ray, nemotron, glm, etc.
- Resource estimator usage and how `estimate` works
- Guidance on adding your own models
- Links to the auto-generated shell reference

**What this enables**

- Picking the right (safe) starting workload based on current free GPUs
- Always beginning with `kimi-test` for validation before scaling up
- Using live `estimate <model>` (with {{PLACEHOLDER}} support) to get a ready-to-run command
- Understanding safety and multi-node requirements before launching heavy jobs

> Use `bazelisk run //:manage -- estimate <model>` (or the classic `./scripts/manage.sh estimate <model>`) for a live recommendation based on current cluster capacity.
>
> The full list of models, flags, and helpers is **auto-generated** from structured comments in the scripts — see [Shell Commands & Helpers](generated/shell/reference.md) (refreshed via `bazelisk run //docs:docs`).

## Quick Comparison

| Model / Job            | GPUs | Memory (req) | Purpose                     | Safety Notes                     | NCCL / Multi-node |
|------------------------|------|--------------|-----------------------------|----------------------------------|-------------------|
| kimi-test             | 2    | 32Gi        | First validation, safe      | Always run this before heavy     | Works on 1 node   |
| kimi                  | 8    | 128Gi       | Full production (example)   | Requires confirmation + capacity | High-speed on 2+  |
| ray-head + worker     | ~2   | 16Gi        | Distributed orchestration   | Start before nemotron/glm        | Required for 2+   |
| nemotron-3-ultra      | 8    | 128Gi+      | NVFP4 large model (legacy 8-GPU profile) | Validate with test + ray first   | 2-node preferred  |
| nemotron-3-nano-30b   | 1    | 40Gi        | Agent orchestrator (Mamba-MoE) | Heavy confirm + capacity        | 1-node optimal    |
| nemotron-3-nano-omni-30b | 1 | 45Gi        | Multimodal + doc intel      | 1-node full stack orchestrator   | 1-node            |
| nemotron-3-super-120b | 1    | 95Gi        | Hard reasoning NVFP4        | gpu-mem 0.65 on Spark            | 1–4 nodes         |
| nemotron-retriever-*  | 0    | 4–6Gi       | NIM embed/rerank (CPU)      | Stack aux only                   | All presets       |
| nemotron-parse        | 1    | 8Gi         | NIM document parse          | 2+ node stacks                   | 2–4 nodes         |
| nemotron-safety-guard | 0    | 4Gi         | NeMo Guard NIM (CPU)        | Always-on in stacks              | All presets       |
| glm-5.2               | 2    | 110Gi+      | 1-bit UD-IQ1_M llama.cpp RPC (2-node dual-400G) | Validate with test first; quality trade-off | 2-node required (no Ray) |
| qwen3.5-122b-a10b-nvfp4 | 1 | 95Gi        | Qwen 3.5 122B NVFP4 (1-node 397B substitute) | vLLM cu130-nightly + transformers 5.x | 1-node            |
| qwen3.5-397b-spark2   | 2    | 220Gi       | Qwen 397B int4-AutoRound (2-node 397B substitute) | Ray + vLLM; ~26-30 tok/s on dual Spark | 2-node + Ray      |
| qwen3.5-397b-nvfp4    | 4    | 460Gi+      | Qwen 397B NVFP4 (exact HF checkpoint) | SGLang TP=4; displaces other LLMs | 4-node required   |

**Image + NCCL + hostNetwork unification/consistency** (across kimi, kimi-test, nemotron-3-ultra):

- vLLM image unified to v0.8.5 (MoE/FP8/aarch64 support) for kimi/nemotron
- glm-5.2 uses custom `lab/llama-cpp-gb10:rpc` (GB10 sm_121 + RPC); build on-node
- Minor NCCL alignment (SOCKET_NTHREADS etc added to shorter; "kept in sync with kimi-test baseline")
- hostNetwork: true kept on heavy ray workloads (nemotron/glm); omitted (w/ comments) on kimi/kimi-test. Full decision + per-job comments in the k8s yamls.

All heavy jobs use:

- `restartPolicy: OnFailure`
- `backoffLimit: 1` (or 2 for test)
- explicit `resources.requests` + `limits`
- `gpu-memory-utilization` capped at 0.82–0.90

Never let these jobs auto-restart.

## Detailed Profiles

### kimi-test (recommended starting point)

```bash
./scripts/manage.sh start-test
# or
./scripts/manage.sh estimate kimi-test
```

- Lightweight tensor-parallel
- Good for verifying the full stack (K3s, GPU Operator, high-speed, storage mounts)
- Uses unified v0.8.5 image (see unification note above)

### kimi (full heavy)

**Only after successful kimi-test runs.**

See `k8s/workloads/kimi/kimi-job.yaml` and its README for exact NCCL and resource settings (unified image/NCCL/hostNetwork notes).

### Nemotron agentic stack (recommended)

See [nemotron-agentic-stack.md](nemotron-agentic-stack.md) for one-click presets on 1–4 Spark nodes.

```bash
bazelisk run //scripts:run-utility -- nemotron-stack start nemotron-agentic-spark-1 --confirm yes
```

### Qwen 3.5 agentic stacks (tier substitutes)

When `nvidia/Qwen3.5-397B-A17B-NVFP4` does not fit your cluster, use the same agentic architecture (orchestrator + CPU RAG + safety) with tier substitutes from `config/nemotron-catalog.yaml` (`qwen_tiers`):

| Cluster | Stack ID | Substitute model | HF checkpoint |
|---------|----------|------------------|---------------|
| 1× Spark | `qwen-agentic-spark-1` | Qwen 122B NVFP4 | `RedHatAI/Qwen3.5-122B-A10B-NVFP4` |
| 2× Spark | `qwen-agentic-spark-2` | Qwen 397B int4-AutoRound | `Intel/Qwen3.5-397B-A17B-int4-AutoRound` |
| 4× Spark | `qwen-agentic-spark-4` | Qwen 397B NVFP4 | `nvidia/Qwen3.5-397B-A17B-NVFP4` |

```bash
bazelisk run //scripts:run-utility -- download-qwen-models run --tier all
bazelisk run //scripts:run-utility -- nemotron-stack start qwen-agentic-spark-2 --confirm yes
```

### Ray + Large Models (nemotron-3-ultra legacy)

Nemotron Ultra (legacy profile) requires a healthy Ray cluster first:

```bash
./scripts/manage.sh start-ray
./scripts/manage.sh start-nemotron-3-ultra
```

### GLM-5.2 (1-bit UD-IQ1_M + llama.cpp RPC)

**No Ray required.** Requires 2 nodes (spark0 + spark1) and pre-downloaded GGUF shards:

```bash
bazelisk run //scripts:run-utility -- download-glm52-gguf run
docker build -t lab/llama-cpp-gb10:rpc k8s/workloads/glm-5.2/
./scripts/manage.sh start-glm-5.2
```

**GLM-5.2 ultra (2-node DGX Spark)**: See `k8s/workloads/glm-5.2/` for the 1-bit UD-IQ1_M llama.cpp RPC config (~228 GB model, ~8 tok/s @ 256K). Quality trade-off vs nemotron NVFP4 — use when footprint is the constraint.

The estimator will warn you if free GPUs look insufficient.

## Adding Your Own Model

See the "Add your model" section in the main getting-started or the generator pattern in the workloads directory.

**Auto-generated reference**: The shell lookup functions and profiles are also documented in the generated reference (built from comments in `scripts/lib/models.sh`).

See also the auto-generated Shell Reference in the site navigation.

Basic pattern:
1. Copy `kimi-test/` as a starting point.
2. Adjust resources, image, env (MODEL, quantization, NCCL).
3. Add entry to `scripts/lib/models.sh` lookup functions.
4. Add a `start-xxx` wrapper in `models.sh` with appropriate warnings.
5. Add BATS coverage.
6. Document in this catalog.

Always keep `restartPolicy: OnFailure` + low backoff for anything > ~4 GPUs.

## Configuration sources

`ansible/inventory/group_vars/all.yml` holds **reference defaults** (`llm_*`, NCCL templates, dev-tool versions) for Ansible roles and documentation. **Authoritative** values for a running workload are always the committed manifests under `k8s/workloads/` and the profiles in `scripts/lib/models.sh` (used by `estimate` / `start-*`). Treat `group_vars` as a starting point — not the sole source of truth for deployed Jobs.

## Resource Estimator Usage

```bash
./scripts/manage.sh estimate kimi
./scripts/manage.sh estimate nemotron-3-ultra
```

It prints:

- Detected free GPUs
- Profile (GPUs + memory)
- A suggested command with `{{PLACEHOLDER}}` variables that the interactive docs can substitute.

## Related

- [getting-started.md](getting-started.md)
- [troubleshooting.md](troubleshooting.md)
- Workload yamls under `k8s/workloads/`
- `scripts/manage.sh doctor`
