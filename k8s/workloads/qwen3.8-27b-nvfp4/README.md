# Qwen 3.8 27B NVFP4 (dense, 1-node)

1-GPU vLLM Job for `unsloth/Qwen3.8-27B-NVFP4` with native MTP speculative decoding.

## Requirements

- 1 logical GPU, ~48 Gi memory (exclusive: gpu-mem-util **0.72**, max-len **131072**)
- Raise max-len to 262144 only when exclusive and measured
- vLLM `cu130-nightly` + Blackwell kernels (`CUTE_DSL_ARCH=sm_121a`)
- `--attention-backend triton_attn` for FP8 KV on sm_121
- Weights under `/mnt/models`
- Optional quality swap (not default): `nvidia/Qwen3.8-27B-NVFP4`

Do **not** copy the 3-node QSFP ring NCCL block onto this Job. Native MTP only — DFlash2 is not the default.

## Usage

```bash
bazelisk run //scripts:run-utility -- download-qwen-models run --tier 27b-38-nvfp4
bazelisk run //:manage -- start-qwen38-27b
bazelisk run //:manage -- start-qwen38-27b --with-litellm
bazelisk run //:manage -- stop-qwen38-27b
```

LiteLLM profile aliases: `lab-auto`, `lab-quality`, `lab-qwen38-27b`. Open WebUI default model is `lab-auto`.

Refuses Mode B (GLM-5.3-Flash TP=3) and Mode C (DeepSeek-V4.1-Flash TP=3).
