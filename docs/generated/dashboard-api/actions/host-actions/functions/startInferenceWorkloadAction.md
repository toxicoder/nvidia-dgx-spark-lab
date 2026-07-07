[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / startInferenceWorkloadAction

# Function: startInferenceWorkloadAction()

> **startInferenceWorkloadAction**(`model`, `confirm?`): `Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Defined in: actions/host-actions.ts:253

Start an inference workload for a model.

## Parameters

### model

`string`

Model id (validated via [InferenceModelNameSchema](../../../lib/validation/variables/InferenceModelNameSchema.md)).

### confirm?

`string`

Optional heavy-model confirmation (`yes`).

## Returns

`Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Utility script stdout/stderr and exit code.

## Throws

When session is missing, model fails validation, or confirm is invalid.
