[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / isInferenceModelName

# Function: isInferenceModelName()

> **isInferenceModelName**(`value`): value is "kimi-test" \| "kimi" \| "ray-head" \| "nemotron-3-ultra" \| "nemotron-3-nano-30b" \| "nemotron-3-nano-omni-30b" \| "nemotron-3-super-120b" \| "nemotron-retriever-embed" \| "nemotron-retriever-rerank" \| "nemotron-parse" \| "nemotron-safety-guard" \| "nemotron-speech-asr" \| "nemotron-speech-tts" \| "glm-5.2" \| "qwen3.5-122b-a10b-nvfp4" \| "qwen3.5-397b-spark2" \| "qwen3.5-397b-nvfp4" \| "qwen3.6-27b-nvfp4" \| "qwen3.6-35b-a3b-nvfp4" \| "qwen3.8-27b-nvfp4" \| "qwen3.8-flash-next-nvfp4" \| "glm-5.3-flash" \| "deepseek-v4.1-flash" \| "deepseek-v4-flash-dspark" \| "glm-5.3-flash-exl3-tensorfold" \| "qwen3.8-27b-exl3-16gb" \| "qwen3.8-27b-tensorfold" \| "qwen3.8-flash-next-tensorfold" \| "nemotron-3.5-transcribe-30b-a4b-nvfp4" \| "litellm" \| "comfy-base" \| "flux-fast" \| "flux-quality" \| "ltx-balanced" \| "ltx-quality" \| "flux-to-ltx"

Defined in: [lib/types/index.ts:342](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L342)

Narrow a name the cluster reported to one the dashboard catalog knows.

Cluster-reported model names arrive as plain `string`: a Job can outlive a
catalog edit, so a strict enum at the parse boundary would reject a whole
status payload over one unrecognised name. Callers that need an
[InferenceModelName](../type-aliases/InferenceModelName.md) narrow with this predicate, which keeps the cast
out of the call site.

## Parameters

### value

`string`

Model id as reported by the cluster.

## Returns

value is "kimi-test" \| "kimi" \| "ray-head" \| "nemotron-3-ultra" \| "nemotron-3-nano-30b" \| "nemotron-3-nano-omni-30b" \| "nemotron-3-super-120b" \| "nemotron-retriever-embed" \| "nemotron-retriever-rerank" \| "nemotron-parse" \| "nemotron-safety-guard" \| "nemotron-speech-asr" \| "nemotron-speech-tts" \| "glm-5.2" \| "qwen3.5-122b-a10b-nvfp4" \| "qwen3.5-397b-spark2" \| "qwen3.5-397b-nvfp4" \| "qwen3.6-27b-nvfp4" \| "qwen3.6-35b-a3b-nvfp4" \| "qwen3.8-27b-nvfp4" \| "qwen3.8-flash-next-nvfp4" \| "glm-5.3-flash" \| "deepseek-v4.1-flash" \| "deepseek-v4-flash-dspark" \| "glm-5.3-flash-exl3-tensorfold" \| "qwen3.8-27b-exl3-16gb" \| "qwen3.8-27b-tensorfold" \| "qwen3.8-flash-next-tensorfold" \| "nemotron-3.5-transcribe-30b-a4b-nvfp4" \| "litellm" \| "comfy-base" \| "flux-fast" \| "flux-quality" \| "ltx-balanced" \| "ltx-quality" \| "flux-to-ltx"

Whether the id is in the dashboard catalog.
