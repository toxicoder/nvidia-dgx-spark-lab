[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/ollama](../README.md) / listOllamaModels

# Function: listOllamaModels()

> **listOllamaModels**(): `Promise`\<[`OllamaModelsResult`](../../../types/interfaces/OllamaModelsResult.md)\>

Defined in: lib/services/ollama.ts:19

List locally available Ollama models.

## Returns

`Promise`\<[`OllamaModelsResult`](../../../types/interfaces/OllamaModelsResult.md)\>

Raw `ollama list` stdout or an unavailable message.
