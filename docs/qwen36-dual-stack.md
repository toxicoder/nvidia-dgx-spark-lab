---
title: Qwen3.6 Dual Stack (27B + 35B-A3B)
description: Concurrent NVFP4 serving of Qwen3.6 dense and MoE models on a single DGX Spark with GPU time-slicing, MTP, and Open WebUI model selection.
tags: [qwen, inference, nvfp4, vllm, dual, dgx-spark]
---

# Qwen3.6 Dual Stack (27B + 35B-A3B)

**What's on this page**

- Architecture for concurrent dual-model serving on 1× GB10
- Launch, stop, and status commands
- Memory modes (exclusive vs dual) and expected throughput
- Thinking / vision toggles and benchmark recipes

**What this enables**

- Side-by-side **Qwen3.6-27B** (dense quality) and **Qwen3.6-35B-A3B** (MoE speed) on one Spark
- Open WebUI model selector with both OpenAI-compatible backends
- Safe manual lifecycle via Jobs + Resource Guard

## Hardware assumptions

| Resource | Value |
| --- | --- |
| Node | 1× DGX Spark (GB10 Blackwell, ARM64) |
| Unified memory | 128 GB LPDDR5x |
| Physical GPUs | 1 (time-sliced to 2 logical for dual) |

## Models

| Role | Job / Service | Checkpoint | Notes |
| --- | --- | --- | --- |
| Dense quality | `qwen3.6-27b-nvfp4` | `unsloth/Qwen3.6-27B-NVFP4` | MTP; hybrid thinking; vision |
| MoE speed | `qwen3.6-35b-a3b-nvfp4` | `unsloth/Qwen3.6-35B-A3B-NVFP4-Fast` | `--moe-backend flashinfer_b12x` required on Spark |

Engine: **vLLM** image `vllm/vllm-openai:cu130-nightly` with `CUTE_DSL_ARCH=sm_121a`.

## Memory modes

| Mode | gpu-memory-utilization | max-model-len | When |
| --- | --- | --- | --- |
| **Exclusive** (base Jobs) | 0.72 | 131072 (raise to 262144 if free) | One model only |
| **Dual** (overlay) | 0.38 each | 65536 each | Concurrent both |

Indicative dual budget (~128 GB unified):

| Item | Estimate |
| --- | --- |
| OS + K3s + headroom | ~20–28 Gi |
| 27B NVFP4 weights | ~18–22 Gi |
| 35B-A3B NVFP4-Fast weights | ~18–24 Gi |
| KV / activations (split) | remainder |
| K8s request per Job | 48 Gi |

**Trade-offs**

| Quant / mode | Pros | Cons |
| --- | --- | --- |
| NVFP4 (default) | Fastest on GB10; dual fits | Slight quality loss vs FP8/BF16 |
| FP8 | Higher fidelity | Harder dual fit; lower ctx |
| MTP (2 draft tokens) | Faster decode | Slightly more memory |
| Dual concurrent | Two UIs / agents at once | Shared SMs; lower tok/s each |

## Commands

### Download weights

```bash
bazelisk run //scripts:run-utility -- download-qwen-models run --tier qwen36
# or per model:
bazelisk run //scripts:run-utility -- download-qwen-models run --tier 27b-nvfp4
bazelisk run //scripts:run-utility -- download-qwen-models run --tier 35b-a3b-nvfp4
```

### Exclusive

```bash
bazelisk run //:manage -- start-qwen36-27b
bazelisk run //:manage -- start-qwen36-35b-a3b
bazelisk run //:manage -- status-qwen36
bazelisk run //:manage -- stop-qwen36
bazelisk run //:manage -- estimate qwen3.6-27b-nvfp4
```

### Dual concurrent

Requires **GPU time-slicing** (2 logical GPUs). ConfigMap is under `k8s/base/gpu-time-slicing/`. Ansible flag: `gpu_time_slicing_enabled: true`.

```bash
bazelisk run //:manage -- start-qwen36-dual
# applies dual overlay + capacity stack:qwen36-dual-spark-1
bazelisk run //:manage -- status-qwen36
bazelisk run //:manage -- stop-qwen36
```

### Resource estimate

```bash
bazelisk run //:manage -- estimate qwen3.6-27b-nvfp4
bazelisk run //:manage -- estimate qwen3.6-35b-a3b-nvfp4
bazelisk run //:manage -- estimate qwen36-dual-spark-1
```

## Expected throughput (order of magnitude)

Measure on your Spark; Unsloth B200 numbers are higher.

| Config | Decode tok/s (approx.) |
| --- | --- |
| 27B exclusive + MTP | ~80–140+ |
| 35B-A3B exclusive + MTP | ~150–250+ |
| Dual concurrent | each lower; SM sharing |

## Open WebUI

Helm values register three OpenAI bases: Hermes gateway + both Qwen3.6 services. In the UI, select **Qwen3.6-27B** or **Qwen3.6-35B-A3B** (or open parallel chats).

```yaml
# ansible/files/open-webui-values.yaml
openaiBaseApiUrls:
  - "http://hermes-gateway.dev.svc.cluster.local:8642/v1"
  - "http://qwen3.6-27b-nvfp4.ai-inference.svc.cluster.local:8000/v1"
  - "http://qwen3.6-35b-a3b-nvfp4.ai-inference.svc.cluster.local:8000/v1"
```

Redeploy Open WebUI after values change: `./scripts/manage.sh start-open-webui` (or utility).

## Thinking / vision

Hybrid thinking is preserved via `--reasoning-parser qwen3`. Client-side:

- **Thinking on**: default chat template / `enable_thinking: true`
- **Thinking off**: `"chat_template_kwargs": {"enable_thinking": false}`
- **Preserve thinking**: `preserve_thinking: true` (more tokens, better multi-turn)

Vision: `--limit-mm-per-prompt image=4`. For pure text headroom under dual load, set `image=0` in a custom patch.

Sampling (from Qwen docs): thinking general `temp=1.0`; precise coding `temp=0.6`; instruct `temp=0.7`, `presence_penalty=1.5`.

## Benchmarks

```bash
# Port-forward both services first
kubectl port-forward -n ai-inference svc/qwen3.6-27b-nvfp4 8001:8000 &
kubectl port-forward -n ai-inference svc/qwen3.6-35b-a3b-nvfp4 8002:8000 &

bazelisk run //scripts:run-utility -- benchmark-qwen36 run --model 27b --concurrency 1,4
bazelisk run //scripts:run-utility -- benchmark-qwen36 run --dual --concurrency 4
bazelisk run //scripts:run-utility -- benchmark-qwen36 run --dry-run
```

Agentic / SWE-bench style: point any OpenAI-compatible harness at:

- `http://127.0.0.1:8001/v1` model `unsloth/Qwen3.6-27B-NVFP4`
- `http://127.0.0.1:8002/v1` model `unsloth/Qwen3.6-35B-A3B-NVFP4-Fast`

## Kernel self-check (inside vLLM pod)

```bash
python -c "
import torch
from vllm.utils.flashinfer import has_flashinfer_b12x_gemm as g, has_flashinfer_b12x_moe as m
cap = torch.cuda.get_device_capability()
print('cap', cap, 'b12x gemm', g(), 'b12x moe', m())
assert cap[0] == 12 and g() and m()
"
```

## Safety

- Jobs only (`restartPolicy: OnFailure`, `backoffLimit: 1`) — no auto-start on reboot
- Heavy confirmation + `enforce_capacity` for dual stack
- Dual requires time-slicing; exclusive uses one logical GPU
- Do not raise dual util above ~0.40 without measuring free unified memory

## Related paths

- `k8s/workloads/qwen3.6-27b-nvfp4/`
- `k8s/workloads/qwen3.6-35b-a3b-nvfp4/`
- `k8s/overlays/single-node/qwen36-dual/`
- `k8s/base/gpu-time-slicing/`
- `config/resource-policy.yaml` → stack `qwen36-dual-spark-1`
