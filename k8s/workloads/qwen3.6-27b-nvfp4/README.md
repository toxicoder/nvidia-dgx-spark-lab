# Qwen 3.6 27B NVFP4 (dense, quality)

1-GPU vLLM Job for `unsloth/Qwen3.6-27B-NVFP4` with MTP speculative decoding.

## Requirements

- 1 logical GPU, ~48 Gi memory (exclusive: gpu-mem-util 0.72, max-len 131072)
- Dual concurrent: use overlay `k8s/overlays/single-node/qwen36-dual` (util ~0.38, max-len 65536)
- vLLM `cu130-nightly` + Blackwell kernels (`CUTE_DSL_ARCH=sm_121a`)
- Weights under `/mnt/models`

## Usage

```bash
bazelisk run //scripts:run-utility -- download-qwen-models run --tier 27b-nvfp4
bazelisk run //:manage -- start-qwen36-27b
bazelisk run //:manage -- status-qwen36
bazelisk run //:manage -- stop-qwen36
```

## Dual stack

```bash
bazelisk run //:manage -- start-qwen36-dual
```

See [docs/qwen36-dual-stack.md](../../../docs/qwen36-dual-stack.md).
