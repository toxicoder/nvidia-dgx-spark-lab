[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/inference-workloads](../README.md) / startInferenceWorkload

# Function: startInferenceWorkload()

> **startInferenceWorkload**(`model`, `confirm`): `Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Defined in: lib/services/inference-workloads.ts:61

Start an inference workload for a model.

## Parameters

### model

[`InferenceModelName`](../../../types/type-aliases/InferenceModelName.md)

Model id to deploy.

### confirm

`string`

Heavy-model confirmation (`yes` or empty).

## Returns

`Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Script stdout, stderr, and exit code.
