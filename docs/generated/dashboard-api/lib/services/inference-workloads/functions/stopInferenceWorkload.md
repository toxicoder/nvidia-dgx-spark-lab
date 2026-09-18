[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/inference-workloads](../README.md) / stopInferenceWorkload

# Function: stopInferenceWorkload()

> **stopInferenceWorkload**(`target`): `Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Defined in: [lib/services/inference-workloads.ts:90](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/inference-workloads.ts#L90)

Stop an inference workload, Ray head, or all workloads.

## Parameters

### target

`string`

Model id, `all`, or `ray`.

## Returns

`Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Script stdout, stderr, and exit code.
