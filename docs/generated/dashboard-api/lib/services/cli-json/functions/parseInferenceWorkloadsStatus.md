[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseInferenceWorkloadsStatus

# Function: parseInferenceWorkloadsStatus()

> **parseInferenceWorkloadsStatus**(`stdout`, `utility`): [`InferenceWorkloadsStatus`](../../../types/interfaces/InferenceWorkloadsStatus.md)

Defined in: [lib/services/cli-json.ts:458](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L458)

Parse the inference/visual workload status.

## Parameters

### stdout

`string`

Raw stdout from `inference-workloads.sh status --json`.

### utility

`string`

Utility name for diagnostics.

## Returns

[`InferenceWorkloadsStatus`](../../../types/interfaces/InferenceWorkloadsStatus.md)

The validated status payload.

## Throws

CliPayloadError When the payload is unusable. A payload whose `jobs` is
  absent or malformed is rejected rather than read as an empty list, so the
  panel cannot render "nothing is deployed" when the truth is unknown.
