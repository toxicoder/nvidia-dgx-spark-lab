[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getInferenceWorkloadsAction

# Function: getInferenceWorkloadsAction()

> **getInferenceWorkloadsAction**(): `Promise`\<[`InferenceWorkloadsStatus`](../../../lib/types/interfaces/InferenceWorkloadsStatus.md)\>

Defined in: actions/host-actions.ts:241

Fetch inference workload (K8s job) status for all models.

## Returns

`Promise`\<[`InferenceWorkloadsStatus`](../../../lib/types/interfaces/InferenceWorkloadsStatus.md)\>

InferenceWorkloadsStatus from `inference-workloads.sh`.

## Throws

When session is missing.
