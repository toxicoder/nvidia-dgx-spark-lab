[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/inference-workloads](../README.md) / getInferenceWorkloadsStatus

# Function: getInferenceWorkloadsStatus()

> **getInferenceWorkloadsStatus**(): `Promise`\<[`InferenceWorkloadsStatus`](../../../types/interfaces/InferenceWorkloadsStatus.md)\>

Defined in: [lib/services/inference-workloads.ts:39](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/inference-workloads.ts#L39)

Fetch inference workload (K8s job) status for all models.

## Returns

`Promise`\<[`InferenceWorkloadsStatus`](../../../types/interfaces/InferenceWorkloadsStatus.md)\>

Per-model job state and Ray head status.
