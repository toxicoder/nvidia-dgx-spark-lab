# DeepSeek-V4.1-Flash official MXFP4 TP=3 (Mode C, 3-node QSFP ring)

Exclusive frontier lane. Official checkpoint only. Uses the **ConnectX-7 200 Gb/s triangle**, not the 2-node dual-400G pair vars.

## What this is (and is not)

| Use | Do not use |
| --- | --- |
| `deepseek-ai/DeepSeek-V4.1-Flash` native MXFP4 experts + FP8/MXFP8 dense | `nvidia/DeepSeek-V4-Flash-NVFP4` (old **284B** V4-Flash) |
| Engram tables on **local NVMe** (`OFFLOAD_MODE=nvme`) | LibertAIDAI / community NVFP4 requants |
| SGLang + MiaAI-Lab GB10 overlay, image `dsv41-flash-tp3:local` | Stock vLLM nightly; RAM Engram offload |
| 3× Spark TP=3 | 1-node or 2-node (does not fit) |

A 4th Spark → TP=4 overlay is a **promotion path**, not this tree.

## Cabling (NVIDIA polarity)

```
Node1 Port0 → Node2 Port1
Node2 Port0 → Node3 Port1
Node3 Port0 → Node1 Port1
```

Port0 = QSFP cage next to the RJ-45 jack; Port1 = far cage. Triangle mesh, not NVLink. MTU 9000 on CX-7. Confirm names with `ibdev2netdev` on every node.

## NCCL (Mode C — same ring block as Mode B)

Do **not** copy `ansible/inventory/group_vars/all.yml` `highspeed_*` / `nccl_env` (`enp1s0f0np0,enp1s0f1np1` + `mlx5_0,mlx5_1`).

Jobs set the GLM Mode B ring block plus UMA buffer cuts:

```
NCCL_SOCKET_IFNAME=<mgmt, default enP7s7>
NCCL_IB_HCA=rocep1s0f0,roceP2p1s0f0,rocep1s0f1,roceP2p1s0f1
NCCL_NET_PLUGIN=none
NCCL_BUFFSIZE=1048576
NCCL_LL128_BUFFSIZE=262144
NCCL_PROTO=^LL128
NCCL_MAX_NCHANNELS=8
```

OOB/bootstrap on 10GbE; tensor payload on RoCE. `hostNetwork: true` + `hostIPC: true`. Master is LAN hostname `spark0:29522` (GLM uses 29521).

## Image (build on Spark)

The published overlay is [MiaAI-Lab/DeepSeek-v4.1-Flash-DGX-Sparks](https://github.com/MiaAI-Lab/DeepSeek-v4.1-Flash-DGX-Sparks) (**AGPL-3.0**). This repo does **not** vendor `adapter/` / `boot.py` / `pack_engram.py`.

```bash
# On spark0 (aarch64), follow MiaAI ./start.sh build, then:
docker tag <mia-overlay-image> dsv41-flash-tp3:local
# Copy the same image id to spark1 and spark2 (docker save/load or registry).
```

`imagePullPolicy: IfNotPresent`. Stock `lmsysorg/sglang` cannot pad TP=3 heads (64→96), pack Engram, or route MXFP8 via FlashInfer b12x.

TP=3 head padding is expected (lives in the overlay). TP=4 needs no pad.

## Checkpoint + Engram pack

Disk ~476–510 GiB. After moving ~189–203 GiB Engram tables to NVMe, GPU-resident ≈ 305 GiB (≈ 101 GiB/rank at TP=3).

```bash
bazelisk run //scripts:run-utility -- download-dsv41-flash run
# Then on EVERY node, pack rank-local Engram shards onto NVMe:
#   follow MiaAI-Lab ./start.sh pack
# Shards land at /mnt/models/dsv41-engram (hostPath). Never OFFLOAD_MODE=ram.
```

`OFFLOAD_MODE=ram` evicts the model on UMA. `DSV41_CACHE_GIB=0` (n-gram rows have ~0% reuse; cache would steal GPU RAM).

## First profile (not a tok/s SLO)

| Knob | Value | Why |
| --- | --- | --- |
| `--mem-fraction-static` | **0.95** | MiaAI measured load; ≥0.944 needed to place ~101 GiB weights. Exclusive Mode C only. |
| `--context-length` | **131072** | Lab first profile. 262144 / 1M are exclusive raises. |
| `--max-running-requests` | **1** | Conservative vs MiaAI’s 4 streams. |
| `PYTORCH_CUDA_ALLOC_CONF` | `expandable_segments:False` | True NaNs V4.1 prompts &gt;64 tokens. Do not copy Comfy’s True. |
| DSpark | env `SPEC_ALGO=DSPARK` | Overlay enables speculative decode when present. |

MiaAI left ~6 GiB on the head at 0.95 — inside the 8–12 GiB hang zone. First boot target: process up, SSH up, `/v1/models` returns, one 2k-token completion, **MemAvailable ≥ 8 GiB** on every rank. If that fails, stop. Do not bump toward 1.0.

## Recovery if UMA crowds

Fail-stop, not a watchdog that pins more RAM:

1. `restartPolicy: OnFailure` + `backoffLimit: 1` — crashed Job stays down.
2. Nothing auto-starts on reboot.
3. Mutual exclusion with Mode A and Mode B.
4. If MemAvailable drops below 8 GiB on any rank: `bazelisk run //:manage -- stop-dsv41-flash`.
5. If SSH dies: power-cycle. After reboot the Job is gone.

Do not generate load from spark0 (head) while serving.

## Usage

```bash
bazelisk run //:manage -- doctor-fabric
bazelisk run //:manage -- start-dsv41-flash
bazelisk run //:manage -- start-dsv41-flash --with-litellm
bazelisk run //:manage -- stop-dsv41-flash
```

LiteLLM exclusive profile: `lab-auto` / `lab-frontier-ds`. There is no official DeepSeek-V4.1 (non-Flash) / V4.1-Pro checkpoint.

Refuses any Mode A rounded Job **and** Mode B GLM Job. Heavy confirm. `start-stack-rounded` and `start-glm53-flash` refuse Mode C.

LiteLLM alias: `lab-frontier-ds` → this Service. `lab-frontier` stays GLM. `lab-med` never points at the DeepSeek cloud API.
