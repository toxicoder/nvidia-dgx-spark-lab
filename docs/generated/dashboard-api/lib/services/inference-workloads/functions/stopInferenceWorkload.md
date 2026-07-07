[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/inference-workloads](../README.md) / stopInferenceWorkload

# Function: stopInferenceWorkload()

> **stopInferenceWorkload**(`target`): `Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Defined in: lib/services/inference-workloads.ts:90

Stop an inference workload, Ray head, or all workloads.

## Parameters

### target

`string`

Model id, `all`, or `ray`.

## Returns

`Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Script stdout, stderr, and exit code.
