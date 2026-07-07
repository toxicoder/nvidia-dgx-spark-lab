[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/inference-workloads](../README.md) / getInferenceWorkloadsStatus

# Function: getInferenceWorkloadsStatus()

> **getInferenceWorkloadsStatus**(): `Promise`\<[`InferenceWorkloadsStatus`](../../../types/interfaces/InferenceWorkloadsStatus.md)\>

Defined in: lib/services/inference-workloads.ts:35

Fetch inference workload (K8s job) status for all models.

## Returns

`Promise`\<[`InferenceWorkloadsStatus`](../../../types/interfaces/InferenceWorkloadsStatus.md)\>

Per-model job state and Ray head status.
