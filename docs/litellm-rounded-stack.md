---
title: LiteLLM Rounded Stack (3× DGX Spark)
description: Daily Mode A mixed fleet and exclusive Mode B GLM-5.3-Flash TP=3 behind LiteLLM on a 3-node QSFP ring.
tags: [litellm, inference, nvfp4, vllm, medgemma, glm, dgx-spark, nccl]
---

# LiteLLM Rounded Stack (3× DGX Spark)

**What's on this page**

- Two mutually exclusive modes on three GB10 Sparks
- LiteLLM aliases and Open WebUI wiring
- 3-node QSFP ring cabling and NCCL (Mode B only)
- Medical safety (not a medical device)
- Commands, downloads, and quality/license swaps

**What this enables**

- Daily mixed fleet: fast coding + smart generalist + medical specialist
- Exclusive frontier GLM-5.3-Flash TP=3 that actually uses the QSFP ring
- One OpenAI base URL for chat clients

Nothing auto-starts on reboot. Heavy Jobs are `OnFailure` + `backoffLimit: 1` with explicit resources. Resource Guard 15% / 64Gi headroom applies. New Jobs stay at `gpu-memory-utilization` ≤ 0.82.

## Hardware

Three DGX Spark GB10 nodes (128 GB UMA, sm_121). Two networks — never mix roles:

| Plane | Typical names | Carries |
| --- | --- | --- |
| LAN / management (RJ-45 10GbE) | often `enP7s7` | K3s, SSH, dashboard, LiteLLM, Open WebUI, NCCL bootstrap / Gloo |
| High-speed fabric (CX-7 RoCE) | four RoCE twins per node | NCCL payload / TP all-reduce **only** |

### 3-node QSFP ring (Mode B)

200 Gb/s per physical port (not 400G, not NVLink, not InfiniBand switch). Triangle mesh: every pair has a direct cable.

```
Node1 Port0 → Node2 Port1
Node2 Port0 → Node3 Port1
Node3 Port0 → Node1 Port1
```

Port0 = cage next to the RJ-45 jack; Port1 = far cage. Wrong polarity looks half-alive and dies in NCCL. MTU 9000 on CX-7. All four CX-7 netdevs per node need IPs (six unique /24s). Confirm live names with `ibdev2netdev` before baking env.

**Mode B NCCL** (these Jobs only — do not copy 2-node pair vars):

```
NCCL_SOCKET_IFNAME=<mgmt, default enP7s7>
UCX_NET_DEVICES / GLOO_SOCKET_IFNAME / OMPI_MCA_btl_tcp_if_include = same
NCCL_IB_HCA=rocep1s0f0,roceP2p1s0f0,rocep1s0f1,roceP2p1s0f1
NCCL_IB_DISABLE=0
NCCL_IB_MERGE_NICS=0
NCCL_NET_PLUGIN=none
NCCL_IB_SUBNET_AWARE_ROUTING=1
```

If 10GbE is not `enP7s7`, set `LAB_MGMT_IFNAME`. Do not hard-fail the stack on that string. `ansible/inventory/group_vars/all.yml` `highspeed_*` is the **2-node pair** reference.

K3s/Flannel stay on the LAN. Mode B Jobs use `hostNetwork: true` and `hostIPC: true`. Realistic ring bus is ~12–24 GB/s allgather. Optional GB10 UMA livelock fallback (not default): `NCCL_NET_GDR_LEVEL=0`.

```bash
bazelisk run //:manage -- doctor-fabric
```

## Mode A — daily mixed fleet (default)

| Node | Job | Checkpoint | Aliases |
| --- | --- | --- | --- |
| spark0 | existing `qwen3.6-35b-a3b-nvfp4` | Unsloth NVFP4-Fast, MTP, `flashinfer_b12x` | `lab-fast`, `lab-code` |
| spark1 | `qwen3.8-flash-next-nvfp4` | `RadixArk/Qwen3.8-Flash-Next-NVFP4`, PLE mmap, image `vllm/vllm-openai:qwen38-flash-next` | `lab-smart`, `lab-agent` |
| spark2 | `medgemma-27b` | `google/medgemma-27b-multimodal`, FP8 on `cu130-nightly` | `lab-med`, `lab-med-vision` |

Mode A is TP=1. The ring is unused for tokens. 35B is pinned to spark0 **only** via the rounded overlay so 1-node exclusive/dual still works.

Qwen3.8-Flash-Next: start `max-model-len` 65536; document 262144. Prefix caching off. PLE mmap is mandatory.

`--quality` loads existing `qwen3.6-27b-nvfp4` on spark2 (`lab-quality`). `lab-med` then falls back to `lab-smart` with a medical system prompt (not MedGemma).

Optional `medgemma-4b` sidecar (`lab-med-extract`) is **off by default**. Enable only after Resource Guard says there is GPU headroom. Never treat 4B as the only medical model.

Documented Apache-2 swap if HAI-DEF is a problem: Baichuan-M2-32B (docs only). Do not default to OpenBioLLM-8B or Meditron-7B.

## Mode B — exclusive frontier (uses the ring)

`glm-5.3-flash` leader on spark0 + workers on spark1/spark2. Image `glm53-flash-tp3:local` built on Spark from the published TP=3 overlay (stock nightly cannot do TP=3). Checkpoint `local-inference-lab/GLM-5.3-Flash-NVFP4` (or RedHatAI). MTP default; DFlash2 is CC BY-NC-ND and is not the default.

`start-stack-rounded` and `start-glm53-flash` refuse each other. Heavy confirm. `lab-frontier` is primary; `lab-med` falls back to `lab-frontier` with an explicit prompt that MedGemma is offline and this is a general model.

Do not add GLM 753B as a daily driver. Existing `glm-5.2` 1-bit RPC stays as optional night mode.

## LiteLLM aliases

| Alias | Primary | Fallbacks |
| --- | --- | --- |
| `lab-fast` | qwen3.6-35b-a3b | — |
| `lab-code` | lab-fast | lab-smart |
| `lab-smart` / `lab-agent` | qwen3.8-flash-next | lab-fast |
| `lab-quality` | qwen3.6-27b | `--quality` only |
| `lab-med` | medgemma-27b | lab-smart, then lab-frontier |
| `lab-med-vision` | medgemma-27b-mm | same backend |
| `lab-med-extract` | 4B sidecar if enabled | lab-med |
| `lab-frontier` | glm-5.3-flash | Mode B |
| `lab-auto` | lab-fast | lab-smart |

`api_base`: `http://<svc>.ai-inference.svc.cluster.local:8000/v1`. LiteLLM: `http://litellm.ai-inference.svc.cluster.local:4000/v1` or `http://<spark0-lan>:32040/v1`.

The proxy must stay up if backends are down (per-model 503 is fine).

## Medical safety

- Research / education / clinician-in-the-loop only
- **Not a medical device.** Not for diagnosis or treatment decisions
- Prefer “I don’t know” + ask for a source over fabricated guidelines
- PHI stays on-cluster; no cloud OpenAI medical backup for `lab-med`
- HAI-DEF license on MedGemma

Prompts: `k8s/workloads/litellm/files/lab-med-system.txt` and `lab-med-frontier-fallback.txt`.

## Commands

```bash
bazelisk run //scripts:run-utility -- download-rounded-models run --tier all
bazelisk run //:manage -- start-stack-rounded
bazelisk run //:manage -- start-stack-rounded --quality
bazelisk run //:manage -- stop-stack-rounded
bazelisk run //:manage -- start-medgemma
bazelisk run //:manage -- stop-medgemma
bazelisk run //:manage -- start-glm53-flash
bazelisk run //:manage -- stop-glm53-flash
bazelisk run //:manage -- start-litellm
bazelisk run //:manage -- stop-litellm
bazelisk run //:manage -- status-stack
bazelisk run //:manage -- doctor-fabric
```

Open WebUI model base URL is LiteLLM. Hermes remains the **agent** gateway. Raw Service bypass: `kubectl port-forward -n ai-inference svc/<job> 8000:8000`.

## Related

- [Qwen3.6 Dual Stack](qwen36-dual-stack.md)
- [Open WebUI](open-webui.md)
- [DGX Spark Notes](dgx-spark-notes.md)
- [Models catalog](models-catalog.md)
