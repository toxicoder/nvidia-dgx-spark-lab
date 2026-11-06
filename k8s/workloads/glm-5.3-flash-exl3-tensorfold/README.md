# GLM-5.3-Flash EXL3 TensorFold (2-node Spark pair, 1M context)

> **Upstream repo superseded.** `MiaAI-Lab/GLM-5.3-Flash-EXL3-2x-DGX-Sparks-TensorFold`
> carries a top-of-page banner pointing at
> [`MiaAI-Lab/GLM-5.3-Flash-DGX-Sparks-1104`](https://github.com/MiaAI-Lab/GLM-5.3-Flash-DGX-Sparks-1104).
> Use that repo for anything new; this lane stays pinned to the EXL3/TensorFold v0.6.0
> recipe it was validated against.

Exclusive frontier lane: EXL3 (4 bpw routed experts, BF16 elsewhere, ~176 GB) served by
TensorFold v0.6.0 with **one rank per Spark**, 4 concurrent streams, 1,048,576-token
window, images and video. Rank 0 (leader, and the only rank with the vision tower) runs
on `spark0`, rank 1 on `spark1`.

## Cabling (direct QSFP pair)

Cable the two Sparks **directly to each other on both rails** - ConnectX-7 QSFP
port0-port0 and port1-port1. Each QSFP port exposes two netdevs
(`enp1s0f0np0` / `enP2p1s0f0np0` style names), the pair sits on one static IPv4 subnet
with RoCE v2 GIDs, and two rails measure roughly 1.8x faster all-gather than one.
Verify on both hosts before starting:

```bash
ibdev2netdev          # expect two active RoCE devices per node
ip -br addr           # mgmt (10GbE) plus the fabric subnet
```

This is a point-to-point pair, not the Mode B 3-node ring: the Jobs ship the **pair**
NCCL block (`NCCL_SOCKET_IFNAME=enp1s0f0np0,enp1s0f1np1`, `NCCL_IB_HCA=mlx5_0,mlx5_1`).
Do not copy the ring list (`NCCL_IB_HCA=rocep1s0f0,...` + `NCCL_NET_PLUGIN=none`) here.
`MASTER_ADDR` is the leader hostname `spark0`, never a QSFP IP.

## Capacity gates (check before start)

- **~110 GiB free unified memory per node** at start. `MemAvailable` below that and the
  rank refuses to load; free the other lanes first (`stop-*`), and keep `earlyoom`
  disabled on both hosts so it cannot kill a loading rank.
- **~205 GB free disk per node** for the checkpoint plus the DFlash2 drafter.
- Same image tag on both nodes:
  `ghcr.io/miaai-lab/glm-5.3-flash-exl3-2x-dgx-sparks-tensorfold:v0.6.0`
  (built on `nvcr.io/nvidia/pytorch:26.07-py3`, so the NVIDIA container license applies).

## Checkpoints and licensing

- Checkpoint: `Mia-AiLab/GLM-5.3-Flash-EXL3-4bpw-TensorFold` (~176 GB) at
  `/models/Mia-AiLab__GLM-5.3-Flash-EXL3-4bpw-TensorFold` (hostPath `/mnt/models`).
- Drafter: `incoai/GLM-5.3-Flash-DFlash2` (~2.3 GB), **CC BY-NC-ND 4.0 -
  non-commercial only**. For commercial use set `DRAFTER=mtp` instead; a permission
  granted for the base model does not transfer to the drafter.
- Gated `-Ablit` variants (`Mia-AiLab/GLM-5.3-Flash-EXL3-4bpw-TensorFold-Ablit`,
  `gorbatjovy/GLM-5.3-Flash-DFlash2-ablit-fc`) require `HF_TOKEN`; the download utility
  skips them when the token is unset. Base model: `zai-org/GLM-5.3-Flash`.
- Recipe repo is Apache-2.0; weights carry their own terms.

## Engine knobs

`DENSE=q4`, `KV=fp8` (alt `DENSE=fp8 KV=bf16`), `DRAFTER=dflash2`,
`TENSORFOLD_MEMORY_RESERVE_GIB=14.5` (host reserve on top of the shared KV pool),
`TENSORFOLD_GLM_MAX_IMAGES=50`, `TENSORFOLD_GLM_MAX_VIDEOS=4`, `HF_HOME=/models`,
`HF_HUB_OFFLINE=1`, `RANK` from `NODE_RANK`. There are **no** vLLM-style
`--tensor-parallel` / `--gpu-memory-utilization` flags in this engine - TensorFold takes
`--parallel 4 --context 1048576` and budgets the rest from free memory.

Upstream serves on port **8888**; this lane overrides it to **8000** (`--port 8000`) so
the Service, the probes (`/v1/models` readiness, `/health` liveness) and LiteLLM all use
the house port. `/metrics` is scraped on the same port.

## Usage

```bash
bazelisk run //scripts:run-utility -- download-glm53-flash-exl3 status
bazelisk run //scripts:run-utility -- download-glm53-flash-exl3 run
bazelisk run //:manage -- doctor-fabric
bazelisk run //:manage -- start-glm53-flash-exl3
bazelisk run //:manage -- start-glm53-flash-exl3 --with-litellm
bazelisk run //:manage -- stop-glm53-flash-exl3
```

Workers before leader, heavy confirm, one lane at a time. Refuses any Mode A rounded
Job and Mode C DeepSeek-V4.1-Flash. Backend id for LiteLLM: `glm53-flash-exl3`
(overlay `k8s/overlays/litellm-glm53-flash-exl3`, profile aliases `lab-auto` /
`lab-frontier`, served model name `GLM-5.3-Flash-EXL3`).
