# GLM-5.3-Flash NVFP4 TP=3 (Mode B, 3-node QSFP ring)

Exclusive frontier lane. Uses the **ConnectX-7 200 Gb/s triangle**, not the 2-node dual-400G pair vars.

## Cabling (NVIDIA polarity)

```
Node1 Port0 → Node2 Port1
Node2 Port0 → Node3 Port1
Node3 Port0 → Node1 Port1
```

Port0 = QSFP cage next to the RJ-45 jack; Port1 = far cage. This is a triangle mesh (every pair has a direct cable), not a multi-hop token ring. MTU 9000 on CX-7. All four CX-7 netdevs per node need IPs (six unique /24s). Confirm names with `ibdev2netdev` on every node.

## NCCL (Mode B only)

Do **not** copy `ansible/inventory/group_vars/all.yml` `highspeed_*` / `nccl_env` (those are the **2-node pair** reference: `enp1s0f0np0,enp1s0f1np1` + `mlx5_0,mlx5_1`).

Jobs set:

```
NCCL_SOCKET_IFNAME=<mgmt, default enP7s7>
UCX_NET_DEVICES / GLOO_SOCKET_IFNAME / OMPI_MCA_btl_tcp_if_include = same
NCCL_IB_HCA=rocep1s0f0,roceP2p1s0f0,rocep1s0f1,roceP2p1s0f1
NCCL_IB_DISABLE=0
NCCL_IB_MERGE_NICS=0
NCCL_NET_PLUGIN=none
NCCL_IB_SUBNET_AWARE_ROUTING=1
```

OOB/bootstrap on 10GbE; tensor payload on RoCE. `hostNetwork: true` + `hostIPC: true`. Master addr is the **LAN** hostname `spark0`, never a QSFP IP.

If 10GbE is not `enP7s7`, set `LAB_MGMT_IFNAME` / patch the Job env. Do not hard-fail the stack on that string.

NNNtrance’s recipe uses an NCCL **mesh plugin**. This lab follows the NVIDIA/eugr ring block (`NCCL_NET_PLUGIN=none`) instead.

Optional GB10 UMA livelock fallback (not default): `NCCL_NET_GDR_LEVEL=0`.

Realistic ring bus is ~12–24 GB/s allgather. Community Spark TP recipes hit `ibv_modify_qp 110` inside containers when OOB/device pick is wrong even if host `nccl-tests` looked fine.

## Image and checkpoint

- Image: `glm53-flash-tp3:local` built on Spark from the published TP=3 overlay (see `Dockerfile`). Stock nightly cannot pad 64 heads / MoE width for TP=3.
- Checkpoint: `local-inference-lab/GLM-5.3-Flash-NVFP4` (or `RedHatAI/GLM-5.3-Flash-NVFP4`). Avoid LibertAIDAI (measured expert-scale defect).
- Speculative decode: **MTP** default. DFlash2 (`incoai/GLM-5.3-Flash-DFlash2`) is CC BY-NC-ND; permission does not transfer — optional extra only.
- gpu-mem-util **0.85 exclusive Mode B only** (not the recipe’s 0.88). 0.88 is not shipped. Do not use 0.85 on shared-OS Mode A.
- max-model-len **131072** first; 262144 / 1M are exclusive raises.

## Usage

```bash
bazelisk run //:manage -- doctor-fabric
bazelisk run //:manage -- start-glm53-flash
bazelisk run //:manage -- start-glm53-flash --with-litellm
bazelisk run //:manage -- stop-glm53-flash
```

Refuses any Mode A rounded Job and Mode C DeepSeek-V4.1-Flash. Heavy confirm. `start-stack-rounded` and `start-dsv41-flash` refuse Mode B.
