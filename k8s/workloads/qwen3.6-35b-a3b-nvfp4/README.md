# Qwen 3.6 35B-A3B NVFP4-Fast (MoE, speed)

1-GPU vLLM Job for `unsloth/Qwen3.6-35B-A3B-NVFP4-Fast` with MTP and `flashinfer_b12x` MoE backend.

## Requirements

- 1 logical GPU, ~48 Gi memory (exclusive: gpu-mem-util 0.72)
- Dual concurrent: `k8s/overlays/single-node/qwen36-dual`
- DGX Spark: `CUTE_DSL_ARCH=sm_121a` and `--moe-backend flashinfer_b12x` (required)
- Weights under `/mnt/models`

## Usage

```bash
bazelisk run //scripts:run-utility -- download-qwen-models run --tier 35b-a3b-nvfp4
bazelisk run //:manage -- start-qwen36-35b-a3b
bazelisk run //:manage -- status-qwen36
bazelisk run //:manage -- stop-qwen36
```

See [docs/qwen36-dual-stack.md](../../../docs/qwen36-dual-stack.md).
