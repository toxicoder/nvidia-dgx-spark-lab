[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / stopInferenceWorkloadAction

# Function: stopInferenceWorkloadAction()

> **stopInferenceWorkloadAction**(`target`): `Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Defined in: actions/host-actions.ts:268

Stop an inference workload or Ray head.

## Parameters

### target

`string`

Model id, `all`, or `ray`.

## Returns

`Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Utility script stdout/stderr and exit code.

## Throws

When session is missing or target fails validation.
