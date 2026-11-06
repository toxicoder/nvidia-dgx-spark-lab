[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/ollama](../README.md) / listOllamaModels

# Function: listOllamaModels()

> **listOllamaModels**(): `Promise`\<[`OllamaModelsResult`](../../../types/interfaces/OllamaModelsResult.md)\>

Defined in: [lib/services/ollama.ts:19](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/ollama.ts#L19)

List locally available Ollama models.

## Returns

`Promise`\<[`OllamaModelsResult`](../../../types/interfaces/OllamaModelsResult.md)\>

Raw `ollama list` stdout or an unavailable message.
