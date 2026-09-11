# MedGemma 27B multimodal (spark2, Mode A)

Default medical lane for the 3-node rounded stack.

## License and intended use

- Weights: `google/medgemma-27b-multimodal` under **Health AI Developer Foundations (HAI-DEF)** (gated on Hugging Face).
- **Not a medical device.** Research / education / clinician-in-the-loop only. Not for diagnosis or treatment decisions.
- PHI stays on-cluster. Do not configure a cloud OpenAI medical backup for `lab-med`.
- Text-only fallback: `google/medgemma-27b-it`.
- Documented Apache-2 swap if HAI-DEF is a problem: Baichuan-M2-32B (docs only; not the default). Do not default to OpenBioLLM-8B or Meditron-7B.

## Engine

- Image **`vllm/vllm-openai:cu130-nightly`** — same as Qwen3.6 because MedGemma is Gemma 3 and already loads on that engine. A Gemma-only tag is not required.
- Quant: vLLM **FP8** path (`--quantization fp8`, `--kv-cache-dtype fp8`). No trusted GB10 NVFP4 checkpoint at the time this Job was added. **Do not use GGUF as the primary.**
- Footprint target: ≤ ~40 Gi weights + conservative KV. `max-model-len` **32768** first. gpu-mem-util **0.72**.
- Pin: `spark2`. TP=1. No QSFP ring NCCL.

## Usage

```bash
bazelisk run //scripts:run-utility -- download-rounded-models run --tier medgemma
bazelisk run //:manage -- start-medgemma
bazelisk run //:manage -- stop-medgemma
```

`--quality` on `start-stack-rounded` loads `qwen3.6-27b-nvfp4` on spark2 instead; `lab-med` then falls back to `lab-smart` with a medical system prompt (it is not MedGemma).
