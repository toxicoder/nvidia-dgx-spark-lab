[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / INFERENCE\_MODEL\_NAMES

# Variable: INFERENCE\_MODEL\_NAMES

> `const` **INFERENCE\_MODEL\_NAMES**: readonly \[`"kimi-test"`, `"kimi"`, `"ray-head"`, `"nemotron-3-ultra"`, `"nemotron-3-nano-30b"`, `"nemotron-3-nano-omni-30b"`, `"nemotron-3-super-120b"`, `"nemotron-retriever-embed"`, `"nemotron-retriever-rerank"`, `"nemotron-parse"`, `"nemotron-safety-guard"`, `"nemotron-speech-asr"`, `"nemotron-speech-tts"`, `"glm-5.2"`, `"qwen3.5-122b-a10b-nvfp4"`, `"qwen3.5-397b-spark2"`, `"qwen3.5-397b-nvfp4"`, `"qwen3.6-27b-nvfp4"`, `"qwen3.6-35b-a3b-nvfp4"`, `"qwen3.8-27b-nvfp4"`, `"qwen3.8-flash-next-nvfp4"`, `"glm-5.3-flash"`, `"deepseek-v4.1-flash"`, `"deepseek-v4-flash-dspark"`, `"glm-5.3-flash-exl3-tensorfold"`, `"qwen3.8-27b-exl3-16gb"`, `"qwen3.8-27b-tensorfold"`, `"qwen3.8-flash-next-tensorfold"`, `"nemotron-3.5-transcribe-30b-a4b-nvfp4"`, `"litellm"`, `"comfy-base"`, `"flux-fast"`, `"flux-quality"`, `"ltx-balanced"`, `"ltx-quality"`, `"flux-to-ltx"`\]

Defined in: [lib/types/index.ts:24](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L24)

Model ids the dashboard may start or stop.

Source of truth for `InferenceModelName` and for `InferenceModelNameSchema`.
Kept in sync with the Resource Guard policy `models` map; `//tests:safety_invariants`
asserts every name here exists in `config/resource-policy.json`.
