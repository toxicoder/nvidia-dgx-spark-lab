[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/inference-workloads](../README.md) / getInferenceWorkloadsStatus

# Function: getInferenceWorkloadsStatus()

> **getInferenceWorkloadsStatus**(): `Promise`\<[`InferenceWorkloadsStatus`](../../../types/interfaces/InferenceWorkloadsStatus.md)\>

Defined in: [lib/services/inference-workloads.ts:35](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/inference-workloads.ts#L35)

Fetch inference workload (K8s job) status for all models.

## Returns

`Promise`\<[`InferenceWorkloadsStatus`](../../../types/interfaces/InferenceWorkloadsStatus.md)\>

Per-model job state and Ray head status.
