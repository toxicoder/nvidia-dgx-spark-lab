[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/ollama](../README.md) / listOllamaModels

# Function: listOllamaModels()

> **listOllamaModels**(): `Promise`\<[`OllamaModelsResult`](../../../types/interfaces/OllamaModelsResult.md)\>

Defined in: [lib/services/ollama.ts:19](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/ollama.ts#L19)

List locally available Ollama models.

## Returns

`Promise`\<[`OllamaModelsResult`](../../../types/interfaces/OllamaModelsResult.md)\>

Raw `ollama list` stdout or an unavailable message.
