# DeepSeek-V4-Flash DSpark TP=2 (2-node Spark pair, DSpark speculative decode)

Exclusive frontier lane: DeepSeek-V4-Flash Vision-Exp on **two** DGX Sparks (GB10) with
vLLM TP=2 across the pair, DSpark speculative decoding, and a 1,048,576-token window.
Rank 0 (leader) runs on `spark0`, rank 1 on `spark1`.

## Cabling (2-node pair)

Direct ConnectX-7 link between the two Sparks, **both rails** cabled (port0-port0 and
port1-port1) so NCCL can use both RoCE devices. Each QSFP port exposes two netdevs.
Confirm the device names on both hosts before starting:

```bash
ibdev2netdev          # rocep1s0f0 / roceP2p1s0f0 ... -> netdev names
ip -br addr           # mgmt (10GbE) and RoCE interfaces
```

This lane uses the **2-node pair** NCCL block (the same reference as
`ansible/inventory/group_vars/all.yml` `highspeed_*` / `nccl_env`), not the Mode B
3-node ring block. Do not copy `NCCL_NET_PLUGIN=none` or the four-device
`NCCL_IB_HCA=rocep1s0f0,...` ring list onto these Jobs.

```
NCCL_SOCKET_IFNAME=enp1s0f0np0,enp1s0f1np1
NCCL_IB_HCA=mlx5_0,mlx5_1
NCCL_IB_DISABLE=0  NCCL_P2P_DISABLE=0  NCCL_SHM_DISABLE=0
NCCL_SOCKET_NTHREADS=4  NCCL_NSOCKS_PERTHREAD=4
```

`hostNetwork: true` + `hostIPC: true` + `dnsPolicy: ClusterFirstWithHostNet`.
`MASTER_ADDR` is always the leader hostname `spark0`; `VLLM_HOST_IP` comes from the
pod IP. Override the interface/HCA strings if `ibdev2netdev` differs.

## Host prerequisites

- Same image tag on **both** Sparks: `ghcr.io/anemll/dspark-vllm-gx10:0.1.1`
  (pre-pull it on each host; a missing image on one node stalls the pair).
- `earlyoom` must be **disabled on both hosts** - it kills the loading rank.
- Checkpoint on both nodes' `/mnt/models` (`HF_HOME=/models`, `HF_HUB_OFFLINE=1`):
  `bazelisk run //scripts:run-utility -- download-dsv4-flash-dspark run`
- Roughly 200 GB free on each node's NVMe for the Vision-Exp snapshot.

## Checkpoint and engine

- Checkpoint: `deepseek-ai/DeepSeek-V4-Flash-Vision-Exp` (upstream pins
  `86f746b36186f0e567729a5c06a8c918caba82a9`, `ABLITERATED=0`). Native image support
  only - there is **no video encoder** in this build.
- Optional gated refusal-direction ablit (`drowzeys/keys-DeepSeekV4Flash-Vision-EXP-ablit`,
  18 KiB) needs `HF_TOKEN`; the utility skips it when the token is unset.
- KV cache: Stage C padded NVFP4 sparse-MLA (`--kv-cache-dtype nvfp4_ds_mla`,
  `--block-size 256`, 584-byte envelope). The abandoned 416-byte "true layout" path is
  not shipped. `ENABLE_VLLM_GB10_PATCH=1` (`--quantization modelopt_gb10_hybrid`) is
  upstream-experimental and deliberately not enabled here.
- Memory: `GPU_MEMORY_UTILIZATION_TEXT=0.835` only. **Never** set
  `GPU_MEMORY_UTILIZATION` by hand - upstream measures a broken pair when it is
  hand-set. At 0.835 the pair lands a ~17.04 GiB / 2,331,430-token KV pool.
- Speculative decode: DSpark, `num_speculative_tokens: 6`, with `MTP_NUM_TOKENS=6`
  and `VLLM_USE_BREAKABLE_CUDAGRAPH=0`. `DEFAULT_THINKING=low`.
- Throughput guards: `--max-num-seqs 6`, `--max-num-batched-tokens 8192`,
  `--long-prefill-token-threshold 1024`, `--async-scheduling`,
  `--moe-backend flashinfer_b12x`, `--generation-config vllm`.
- Multimodal cap: `LIMIT_MM_PER_PROMPT={"image":8}`.
- Upstream serves on port **8888**; this lane overrides it to **8000**
  (`VLLM_PORT=8000` plus `--port 8000`) so the Service, probes, and LiteLLM all use the
  house port.

## Usage

```bash
bazelisk run //scripts:run-utility -- download-dsv4-flash-dspark status
bazelisk run //scripts:run-utility -- download-dsv4-flash-dspark run
bazelisk run //:manage -- doctor-fabric
bazelisk run //:manage -- start-dsv4-flash-dspark
bazelisk run //:manage -- start-dsv4-flash-dspark --with-litellm
bazelisk run //:manage -- stop-dsv4-flash-dspark
```

Workers before leader, heavy confirm, one lane at a time. Refuses any Mode A rounded
Job and the Mode B GLM ring. Backend id for LiteLLM: `dsv4-flash-dspark`
(overlay `k8s/overlays/litellm-dsv4-flash-dspark`, profile alias `lab-auto`).

Licensing: upstream recipe code is MIT; the checkpoint and the base image carry their
own terms; the ablit variant is gated.
