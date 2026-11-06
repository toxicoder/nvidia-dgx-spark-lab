# Qwen3.8-27B on one DGX Spark (TensorFold)

Kubernetes lane of [MiaAI-Lab/Qwen3.8-27B-DGX-Spark-TensorFold](https://github.com/MiaAI-Lab/Qwen3.8-27B-DGX-Spark-TensorFold):
Qwen3.8-27B served by **TensorFold v0.6.0** on a **single** DGX Spark (GB10, 128 GB unified
memory). This is the single-node sibling of the multi-node Mode B/C lanes and of the
16 GB consumer-card [ExLlamaV3 lane](../qwen3.8-27b-exl3-16gb/).

## Requirements

- **One Spark only.** The Job pins `kubernetes.io/hostname: spark0`; never run two of these
  (or another exclusive model) on the same node - the KV pool is pinned, not elastic.
- Image: `ghcr.io/miaai-lab/qwen3.8-27b-dgx-spark-tensorfold:v0.6.0` (built on
  `nvcr.io/nvidia/pytorch:26.07-py3`). Pre-pull it on spark0 so `IfNotPresent` never waits
  on egress mid-start: `docker pull ghcr.io/miaai-lab/qwen3.8-27b-dgx-spark-tensorfold:v0.6.0`.
- Checkpoints on the hostPath (`/mnt/models` -> `/models`, `HF_HOME=/models`), ~60 GB free disk:

  ```bash
  bazelisk run //scripts:run-utility -- download-qwen38-27b-tensorfold status
  bazelisk run //scripts:run-utility -- download-qwen38-27b-tensorfold run
  ```

  Target `Vontra/Qwen3.8-27B-MLX-4bit` (~15 GB) + drafter `z-lab/Qwen3.8-27B-DFlash2`
  (~3.6 GB) - about 19 GB total.

## Memory budget

| Figure | Value |
| --- | --- |
| Startup estimate at defaults | ~45 GiB |
| Steady-state process | ~97 GiB (weights + drafter + buffers ~19 GiB, plus the pool) |
| KV pool | pinned, `KV_POOL_GB=auto` up to **78 GiB** (~2.5M tokens at FP8) |
| Concurrency | 8 streams at the default pool (`KV_POOL_GB=72 PARALLEL=16` if you trade pool for streams) |

The Job requests 96Gi / limits 110Gi so the kubelet refuses to co-schedule anything else
heavy on spark0. TensorFold has no vLLM-style `--gpu-memory-utilization`; memory is
controlled by `KV_POOL_GB` (and `TENSORFOLD_MEMORY_RESERVE_GIB` if you need host headroom).

## Usage

```bash
kubectl create namespace ai-inference --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -k k8s/workloads/qwen3.8-27b-tensorfold
kubectl -n ai-inference logs -f job/qwen3.8-27b-tensorfold
# OpenAI endpoint: http://qwen3.8-27b-tensorfold.ai-inference.svc.cluster.local:8000/v1
# Served model id: Qwen3.8-27B
kubectl -n ai-inference delete job qwen3.8-27b-tensorfold
```

LiteLLM: profile `files/profiles/qwen3.8-27b-tensorfold.yaml` + overlay
[`k8s/overlays/litellm-qwen38-27b-tensorfold`](../../overlays/litellm-qwen38-27b-tensorfold/)
(`lab-auto`, `lab-quality`, `lab-qwen38-27b-tensorfold`).

## Tuning (every knob is an env var)

| Env | Default | Notes |
| --- | --- | --- |
| `MODEL_DIR` | `/models/Vontra__Qwen3.8-27B-MLX-4bit` | Affine 4-bit, groups of 64 |
| `DRAFT_DIR` | `/models/z-lab__Qwen3.8-27B-DFlash2` | DFlash2 speculative drafter |
| `SERVED_NAME` | `Qwen3.8-27B` | Must match the LiteLLM profile's `openai/<name>` |
| `PARALLEL` | `8` | Concurrent requests |
| `CONTEXT` | `262144` | Native window |
| `YARN_FACTOR` | `4` | **Optional**: YaRN x4 widens 262,144 to a 1,048,576-token window. Set `1` for native context only |
| `KV_POOL_GB` | `auto` | Pinned up to 78 GiB; set a number to leave room for another workload |
| `KV_DTYPE` | `fp8` | e4m3, 32 KiB/token; `bf16` also available |
| `HF_HOME` | `/models` | HostPath share with the download utility |
| `PORT` | `8000` | Upstream default is **8888**; pinned to 8000 for the Service, probes, and profile |

Multimodal: up to **50 images and video** per request with the MLX checkpoint (upstream
patched build). Probes use `/v1/models`; the engine also serves `/health` and `/metrics`.

### Alternate checkpoint (text only)

`MODEL_DIR=/models/nvidia__Qwen3.8-27B-NVFP4` with **`VISION=0`** (add it to `env:`). The
NVFP4 checkpoint cannot take images and decodes roughly 20-25% slower in the author's test,
so keep it as the A/B, not the default.

## Licensing

- Weights: **Qwen Community License 1.0** (target and drafter - check both model cards
  before commercial or >1M MAU use).
- Upstream recipe: Apache-2.0 with MIT notices on adapted scripts; the NVIDIA base image
  carries the NVIDIA container license.
