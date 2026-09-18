[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getInferenceWorkloadsAction

# Function: getInferenceWorkloadsAction()

> **getInferenceWorkloadsAction**(): `Promise`\<[`InferenceWorkloadsStatus`](../../../lib/types/interfaces/InferenceWorkloadsStatus.md)\>

Defined in: [actions/host-actions.ts:241](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/host-actions.ts#L241)

Fetch inference workload (K8s job) status for all models.

## Returns

`Promise`\<[`InferenceWorkloadsStatus`](../../../lib/types/interfaces/InferenceWorkloadsStatus.md)\>

InferenceWorkloadsStatus from `inference-workloads.sh`.

## Throws

When session is missing.
