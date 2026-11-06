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
- Using live `estimate <model>` (with \{\{PLACEHOLDER\}\} support) to get a ready-to-run command
- Understanding safety and multi-node requirements before launching heavy jobs

> Use `bazelisk run //:manage -- estimate <model>` for a live recommendation based on current cluster capacity.
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
| glm-5.2               | 2    | 110Gi+      | 1-bit UD-IQ1_M llama.cpp RPC (2-node 200G QSFP) | Validate with test first; quality trade-off | 2-node required (no Ray) |
| qwen3.5-122b-a10b-nvfp4 | 1 | 95Gi        | Qwen 3.5 122B NVFP4 (1-node 397B substitute) | vLLM cu130-nightly + transformers 5.x | 1-node            |
| qwen3.5-397b-spark2   | 2    | 220Gi       | Qwen 397B int4-AutoRound (2-node 397B substitute) | Ray + vLLM; ~26-30 tok/s on dual Spark | 2-node + Ray      |
| qwen3.5-397b-nvfp4    | 4    | 460Gi+      | Qwen 397B NVFP4 (exact HF checkpoint) | SGLang TP=4; displaces other LLMs | 4-node required   |
| qwen3.6-27b-nvfp4     | 1    | 48Gi        | Qwen3.6 27B dense NVFP4 (quality + MTP) | Exclusive util 0.72; dual util 0.38 | 1-node            |
| qwen3.6-35b-a3b-nvfp4 | 1    | 48Gi        | Qwen3.6 35B-A3B MoE NVFP4-Fast (speed) | flashinfer_b12x; dual stack with 27B | 1-node            |
| qwen36-dual-spark-1   | 2*   | 96Gi        | Concurrent 27B + 35B-A3B (*logical GPUs) | Time-slicing required | 1-node dual       |
| qwen3.8-27b-nvfp4     | 1    | 48Gi        | Qwen3.8 27B dense NVFP4 (quality + MTP) | Exclusive util 0.72; 131K first | 1-node            |
| qwen3.8-flash-next-nvfp4 | 1 | 92Gi        | Qwen3.8-Flash-Next NVFP4 (spark1) | PLE mmap; util 0.82; 64k ctx first | Mode A TP=1       |
| medgemma-27b          | 1    | 48Gi        | MedGemma 27B multimodal (spark2) | Not a medical device; HAI-DEF; FP8 | Mode A TP=1       |
| medgemma-4b           | 1    | 8Gi         | Optional extract sidecar | Off by default; never the only medical model | sidecar           |
| glm-5.3-flash         | 3    | 100Gi×3     | GLM-5.3-Flash NVFP4 TP=3 | Exclusive Mode B; util 0.85; QSFP ring | 3-node ring       |
| deepseek-v4.1-flash   | 3    | 108Gi×3     | DeepSeek-V4.1-Flash official MXFP4 | Exclusive Mode C; Engram NVMe; SGLang 0.95 | 3-node ring       |
| dsv41-flash-spark-3   | 3    | 324Gi       | Mode C stack (leader + 2 workers) | Refuses Mode A and Mode B | 3-node ring       |
| deepseek-v4-flash-dspark | 2 | 100Gi+100Gi | DeepSeek-V4-Flash DSpark vLLM TP=2 (spec decode, 1M ctx) | Exclusive; util only via GPU_MEMORY_UTILIZATION_TEXT 0.835 | 2-node pair (both rails) |
| glm-5.3-flash-exl3-tensorfold | 2 | 100Gi+100Gi | GLM-5.3-Flash EXL3 4bpw TensorFold over 2 ranks (1M ctx) | Exclusive; DFlash2 draft is CC BY-NC-ND; superseded upstream | 2-node pair (both rails) |
| qwen3.8-27b-exl3-16gb | 1    | 16Gi        | Qwen3.8-27B EXL3 3.0bpw on a 16 GB+ GPU (ExLlamaV3) | Needs 16 GB+ VRAM, Turing or newer, driver 570+ | 1-node (any node)  |
| qwen3.8-27b-tensorfold | 1   | 96Gi        | Qwen3.8-27B TensorFold + MLX-4bit draft (262K ctx) | Exclusive; pinned spark0; refuses Mode B/C | 1-node            |
| qwen3.8-flash-next-tensorfold | 1 | 96Gi     | Qwen3.8-Flash-Next TensorFold FP4-Local (262K ctx) | Exclusive; pinned spark0; local image only | 1-node            |
| nemotron-3.5-transcribe-30b-a4b-nvfp4 | 1 | 48Gi | Nemotron 3.5 Transcribe ASR (NVFP4, OpenAI audio endpoint) | Deployment; no manage.sh verb; Blackwell only | 1-node            |
| litellm               | 0    | 1Gi         | OpenAI proxy / aliases | Management Deployment; LAN only | —                 |
| rounded-spark-3       | 3    | ~189Gi      | Mode A daily fleet + LiteLLM | Mutually exclusive with Mode B and C | 3-node            |
| comfy-base            | 1    | 60Gi        | ComfyUI visual base (Spark patches) | Manual; exclusive visual | 1-node            |
| flux-fast             | 1    | 60Gi        | FLUX.2 Klein 9B NVFP4+Nunchaku | Manual; ~4s/1024² target | 1-node            |
| flux-quality          | 1    | 70Gi        | FLUX.2 Dev FP8 quality | Manual; higher fidelity | 1-node            |
| ltx-balanced          | 1    | 70Gi        | LTX-2.3 distilled FP8 video | Manual; audio-synced | 1-node            |
| ltx-quality           | 1    | 80Gi        | LTX-2.3 BF16 distilled video | Manual | 1-node            |
| flux-to-ltx           | 1    | 90Gi        | Flux→LTX T2I→I2V+audio pipeline | Manual; both models resident | 1-node            |

See [Visual Generative AI on DGX Spark](visual-generative-ai.md) for ComfyUI details.

**Image + NCCL + hostNetwork unification/consistency** (across kimi, kimi-test, nemotron-3-ultra):

- vLLM image unified to v0.8.5 (MoE/FP8/aarch64 support) for kimi/nemotron
- glm-5.2 uses custom `lab/llama-cpp-gb10:rpc` (GB10 sm_121 + RPC); build on-node
- Minor NCCL alignment (SOCKET_NTHREADS etc added to shorter; "kept in sync with kimi-test baseline")
- hostNetwork: true kept on heavy ray workloads (nemotron/glm); omitted (w/ comments) on kimi/kimi-test. Full decision + per-job comments in the k8s yamls.

All heavy jobs use:

- `restartPolicy: OnFailure`
- `backoffLimit: 1` (or 2 for test)
- explicit `resources.requests` + `limits`
- Mode A vLLM `gpu-memory-utilization` ≤ 0.82; Mode B exclusive ≤ 0.85; Mode C SGLang `--mem-fraction-static` ≤ 0.95. Never ship vLLM 0.88/0.90.

Never let these jobs auto-restart.

## Detailed Profiles

### kimi-test (recommended starting point)

```bash
bazelisk run //:manage -- start-test
# or
bazelisk run //:manage -- estimate kimi-test
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

### Qwen3.8-27B (1× Spark)

Dense successor to Qwen3.6-27B. Default checkpoint `unsloth/Qwen3.8-27B-NVFP4` (~23 GB). Exclusive util **0.72**, `max-model-len` **131072** first. Optional `--with-litellm` attaches `lab-auto` to this Service.

There is **no** official DeepSeek-V4.1 / V4.1-Pro checkpoint. Local DeepSeek on this lab is
**V4.1-Flash** (Mode C) plus the **DeepSeek-V4-Flash DSpark** pair lane
(`deepseek-ai/DeepSeek-V4-Flash-Vision-Exp`). Do not use `nvidia/DeepSeek-V4-Flash-NVFP4` (old 284B).

```bash
bazelisk run //scripts:run-utility -- download-qwen-models run --tier 27b-38-nvfp4
bazelisk run //:manage -- start-qwen38-27b --with-litellm
```

### DSpark and TensorFold exclusive lanes (MiaAI recipes)

Five text lanes ported from MiaAI-Lab recipes plus one GPU ASR Deployment. All serve an
OpenAI-compatible API on port 8000 in `ai-inference`, all are `restartPolicy: OnFailure` +
`backoffLimit: 1` (Jobs) with nothing auto-starting on reboot, and every lane is mutually exclusive
with Mode A/B/C and with the other lanes here.

**DeepSeek-V4-Flash DSpark TP=2 (2 Sparks)**. DSpark vLLM fork
`ghcr.io/anemll/dspark-vllm-gx10:0.1.1`, checkpoint `deepseek-ai/DeepSeek-V4-Flash-Vision-Exp`
(snapshot required on **both** nodes of the pair). Flags: `--nnodes 2 --tensor-parallel-size 2`,
`--kv-cache-dtype nvfp4_ds_mla`, `--max-model-len 1048576`, speculative config
`{"method":"dspark","num_speculative_tokens":6}`. `hostNetwork` plus the **2-node pair** NCCL block
(`NCCL_SOCKET_IFNAME=enp1s0f0np0,enp1s0f1np1`, `NCCL_IB_HCA=mlx5_0,mlx5_1`) - not the ring block.
Memory is sized by `GPU_MEMORY_UTILIZATION_TEXT=0.835` only: **never** hand-set
`--gpu-memory-utilization`. Recipe:
[DeepSeek-v4-Flash-DSpark-2x-DGX-Spark](https://github.com/MiaAI-Lab/DeepSeek-v4-Flash-DSpark-2x-DGX-Spark)

**GLM-5.3-Flash EXL3 TensorFold (2 Sparks)**. Two TensorFold ranks (`NODE_RANK` 0/1 against
`MASTER_ADDR` on spark0, `--parallel 4` streams each). TensorFold v0.6.0 image
`ghcr.io/miaai-lab/glm-5.3-flash-exl3-2x-dgx-sparks-tensorfold:v0.6.0`, checkpoint
`Mia-AiLab/GLM-5.3-Flash-EXL3-4bpw-TensorFold`, served with
`tensorfold serve --parallel 4 --context 1048576 --port 8000`. Same pair NCCL block as DSpark.
This recipe is **superseded upstream** by `MiaAI-Lab/GLM-5.3-Flash-DGX-Sparks-1104`, and its
DFlash2 draft is **CC BY-NC-ND** (non-commercial). Recipe:
[GLM-5.3-Flash-EXL3-2x-DGX-Sparks-TensorFold](https://github.com/MiaAI-Lab/GLM-5.3-Flash-EXL3-2x-DGX-Sparks-TensorFold)

**Qwen3.8-27B EXL3 (16 GB+ GPU)**. Node-agnostic (no `nodeSelector`): any node with a
16 GB+ NVIDIA GPU, Turing or newer (compute capability 7.5+), driver 570+. Image
`qwen38-27b-exl3:local` is built locally from `k8s/workloads/qwen3.8-27b-exl3-16gb/Dockerfile`
(pins `exllamav3==1.6.0`, ExLlamaV3 server). Context 199936, `MAX_PARALLEL 4`, `GPU_MEM_GB 14.7`,
weights `turboderp/Qwen3.8-27B-exl3` at 3.0bpw. Recipe:
[Qwen3.8-27B-16gb-NVIDIA-GPUs-one-click-install](https://github.com/MiaAI-Lab/Qwen3.8-27B-16gb-NVIDIA-GPUs-one-click-install)

**Qwen3.8-27B TensorFold (1 Spark)**. Pinned to spark0. Image
`ghcr.io/miaai-lab/qwen3.8-27b-dgx-spark-tensorfold:v0.6.0`; TensorFold serve with an MLX-4bit
draft `Vontra/Qwen3.8-27B-MLX-4bit` plus the `z-lab/Qwen3.8-27B-DFlash2` drafter. Recipe:
[Qwen3.8-27B-DGX-Spark-TensorFold](https://github.com/MiaAI-Lab/Qwen3.8-27B-DGX-Spark-TensorFold)

**Qwen3.8-Flash-Next TensorFold (1 Spark)**. Pinned to spark0. Image `qwen38-flash-next-tf:local`
is built locally from the upstream recipe's `scripts/prepare.sh` (TensorFold Zig
`tensorfold-native` v1.1.4); a prebuilt registry tag is not confirmed, so the lane never pulls at
start. Env-driven: `PARALLEL=5`, `CONTEXT=262144`, `TF_FLASHNEXT_DRAFTS=6`, `KV_DTYPE=fp8`,
`TENSORFOLD_MEMORY_RESERVE_GIB=9`. Weights `nvidia/Qwen3.8-Flash-Next-FP4-Local` pinned to
revision `b9ce18a6887e18c089fdea8509a33e63429a3300`. Recipe:
[Qwen3.8-Flash-Next-Single-DGX-Spark-TensorFold](https://github.com/MiaAI-Lab/Qwen3.8-Flash-Next-Single-DGX-Spark-TensorFold)

```bash
bazelisk run //scripts:run-utility -- download-dsv4-flash-dspark run
bazelisk run //:manage -- start-dsv4-flash-dspark
bazelisk run //:manage -- stop-dsv4-flash-dspark
bazelisk run //scripts:run-utility -- download-glm53-flash-exl3 run
bazelisk run //:manage -- start-glm53-flash-exl3
bazelisk run //:manage -- stop-glm53-flash-exl3
bazelisk run //scripts:run-utility -- download-qwen38-27b-exl3 run
bazelisk run //:manage -- start-qwen38-27b-exl3
bazelisk run //:manage -- stop-qwen38-27b-exl3
bazelisk run //scripts:run-utility -- download-qwen38-27b-tensorfold run
bazelisk run //:manage -- start-qwen38-27b-tensorfold
bazelisk run //:manage -- stop-qwen38-27b-tensorfold
bazelisk run //scripts:run-utility -- download-qwen38-flash-next-tensorfold run
bazelisk run //:manage -- start-qwen38-flash-next-tensorfold
bazelisk run //:manage -- stop-qwen38-flash-next-tensorfold
```

Each of the five text lanes has a LiteLLM profile and a per-backend overlay, so
`--with-litellm` points `lab-auto` at just that Job:
[LiteLLM rounded stack](litellm-rounded-stack.md#exclusive-stacks--litellm-profiles).

**NVIDIA Nemotron 3.5 Transcribe 30B-A4B NVFP4 (ASR)**. A **Deployment**, not a Job
(`k8s/workloads/nemotron-3.5-transcribe-30b-a4b-nvfp4/`, label `family: speech`, 1 GPU, port 8000,
`/health` probes). Image `nemotron-3.5-transcribe:local` is built from
`vllm/vllm-openai:v0.32.0` plus NeMo Speech from main, which supplies the `nemo_speechlm` vLLM
plugin. Checkpoint `nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-NVFP4` (NVFP4, Blackwell only).
Like `nemotron-speech-asr` / `nemotron-speech-tts` this lane has **no `manage.sh` verb**:

```bash
bazelisk run //scripts:run-utility -- download-nemotron-transcribe run
bazelisk run //scripts:run-utility -- inference-workloads start nemotron-3.5-transcribe-30b-a4b-nvfp4 --confirm yes
```

Or start it from the dashboard. Details: `k8s/workloads/nemotron-3.5-transcribe-30b-a4b-nvfp4/README.md`.

### Qwen3.6 dual stack (1× Spark)

Concurrent dense 27B + MoE 35B-A3B NVFP4 with MTP. Full guide: [qwen36-dual-stack.md](qwen36-dual-stack.md).

```bash
bazelisk run //scripts:run-utility -- download-qwen-models run --tier qwen36
bazelisk run //:manage -- start-qwen36-dual
bazelisk run //:manage -- status-qwen36
bazelisk run //:manage -- stop-qwen36
```

### Ray + Large Models (nemotron-3-ultra legacy)

Nemotron Ultra (legacy profile) requires a healthy Ray cluster first:

```bash
bazelisk run //:manage -- start-ray
bazelisk run //:manage -- start-nemotron-3-ultra
```

### GLM-5.2 (1-bit UD-IQ1_M + llama.cpp RPC)

**No Ray required.** Requires 2 nodes (spark0 + spark1) and pre-downloaded GGUF shards:

```bash
bazelisk run //scripts:run-utility -- download-glm52-gguf run
docker build -t lab/llama-cpp-gb10:rpc k8s/workloads/glm-5.2/
bazelisk run //:manage -- start-glm-5.2
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
bazelisk run //:manage -- estimate kimi
bazelisk run //:manage -- estimate nemotron-3-ultra
```

It prints:

- Detected free GPUs
- Profile (GPUs + memory)
- A suggested command with `{{PLACEHOLDER}}` variables that the interactive docs can substitute.

## Related

- [getting-started.md](getting-started.md)
- [troubleshooting.md](troubleshooting.md)
- Workload yamls under `k8s/workloads/`
- `bazelisk run //:manage -- doctor`
