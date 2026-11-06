[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / InferenceModelNameSchema

# Variable: InferenceModelNameSchema

> `const` **InferenceModelNameSchema**: `ZodEnum`\<\{ `comfy-base`: `"comfy-base"`; `deepseek-v4-flash-dspark`: `"deepseek-v4-flash-dspark"`; `deepseek-v4.1-flash`: `"deepseek-v4.1-flash"`; `flux-fast`: `"flux-fast"`; `flux-quality`: `"flux-quality"`; `flux-to-ltx`: `"flux-to-ltx"`; `glm-5.2`: `"glm-5.2"`; `glm-5.3-flash`: `"glm-5.3-flash"`; `glm-5.3-flash-exl3-tensorfold`: `"glm-5.3-flash-exl3-tensorfold"`; `kimi`: `"kimi"`; `kimi-test`: `"kimi-test"`; `litellm`: `"litellm"`; `ltx-balanced`: `"ltx-balanced"`; `ltx-quality`: `"ltx-quality"`; `nemotron-3-nano-30b`: `"nemotron-3-nano-30b"`; `nemotron-3-nano-omni-30b`: `"nemotron-3-nano-omni-30b"`; `nemotron-3-super-120b`: `"nemotron-3-super-120b"`; `nemotron-3-ultra`: `"nemotron-3-ultra"`; `nemotron-3.5-transcribe-30b-a4b-nvfp4`: `"nemotron-3.5-transcribe-30b-a4b-nvfp4"`; `nemotron-parse`: `"nemotron-parse"`; `nemotron-retriever-embed`: `"nemotron-retriever-embed"`; `nemotron-retriever-rerank`: `"nemotron-retriever-rerank"`; `nemotron-safety-guard`: `"nemotron-safety-guard"`; `nemotron-speech-asr`: `"nemotron-speech-asr"`; `nemotron-speech-tts`: `"nemotron-speech-tts"`; `qwen3.5-122b-a10b-nvfp4`: `"qwen3.5-122b-a10b-nvfp4"`; `qwen3.5-397b-nvfp4`: `"qwen3.5-397b-nvfp4"`; `qwen3.5-397b-spark2`: `"qwen3.5-397b-spark2"`; `qwen3.6-27b-nvfp4`: `"qwen3.6-27b-nvfp4"`; `qwen3.6-35b-a3b-nvfp4`: `"qwen3.6-35b-a3b-nvfp4"`; `qwen3.8-27b-exl3-16gb`: `"qwen3.8-27b-exl3-16gb"`; `qwen3.8-27b-nvfp4`: `"qwen3.8-27b-nvfp4"`; `qwen3.8-27b-tensorfold`: `"qwen3.8-27b-tensorfold"`; `qwen3.8-flash-next-nvfp4`: `"qwen3.8-flash-next-nvfp4"`; `qwen3.8-flash-next-tensorfold`: `"qwen3.8-flash-next-tensorfold"`; `ray-head`: `"ray-head"`; \}\>

Defined in: [lib/validation.ts:37](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/validation.ts#L37)

Inference model id allowlist for workload start/stop.

Derived from [INFERENCE\_MODEL\_NAMES](../../types/variables/INFERENCE_MODEL_NAMES.md), the single source of truth shared
with the `InferenceModelName` type. Listing the names twice let the runtime
check and the compile-time type drift.
