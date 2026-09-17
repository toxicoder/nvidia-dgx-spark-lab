# Qwen3.8-Flash-Next NVFP4 (spark1, Mode A)

1-GPU vLLM Job for `RadixArk/Qwen3.8-Flash-Next-NVFP4` on **spark1**.

## Requirements

- Image **`vllm/vllm-openai:qwen38-flash-next`** (architecture is `qwen4_exp`; `cu130-nightly` will not load it)
- `VLLM_PLE_MMAP=1` is mandatory — the PLE n-gram table does not fit in 128 GB UMA without mmap/offload
- gpu-memory-utilization **0.82**; max-model-len **65536** first (raise to **262144** only when exclusive and measured)
- Prefix caching **off** (GB10 GDN kernel bug in Spark TP1 notes)
- Native MTP (`num_speculative_tokens: 3`), FP8 KV
- Alternate checkpoint: `Mia-AiLab/Qwen3.8-Flash-Next-NVFP4` if the RadixArk PLE resolver needs a patch the pinned image lacks

Mode A is TP=1. Do **not** copy the 3-node QSFP ring NCCL block onto this Job.

## Usage

```bash
bazelisk run //scripts:run-utility -- download-rounded-models run --tier flash-next
bazelisk run //:manage -- start-stack-rounded
# or standalone:
bazelisk run //:manage -- start-qwen38-flash-next
bazelisk run //:manage -- start-qwen38-flash-next --with-litellm
```

LiteLLM aliases (rounded): `lab-smart`, `lab-agent` (fallback `lab-fast`). Exclusive profile: `lab-auto` + `lab-smart` / `lab-agent`.

Keep `RadixArk/Qwen3.8-Flash-Next-NVFP4` in this tree (PLE mmap + `qwen38-flash-next` image). `nvidia/Qwen3.8-Flash-Next-NVFP4` is documented as a future on-Spark A/B, not the default.
