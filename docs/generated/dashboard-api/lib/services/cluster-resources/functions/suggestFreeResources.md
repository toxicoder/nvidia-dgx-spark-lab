[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cluster-resources](../README.md) / suggestFreeResources

# Function: suggestFreeResources()

> **suggestFreeResources**(`action`): `Promise`\<[`FreeResourceSuggestion`](../../../types/interfaces/FreeResourceSuggestion.md)[]\>

Defined in: [lib/services/cluster-resources.ts:98](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/cluster-resources.ts#L98)

Suggest workloads to stop in order to free resources for an action.

## Parameters

### action

`string`

Capacity action token.

## Returns

`Promise`\<[`FreeResourceSuggestion`](../../../types/interfaces/FreeResourceSuggestion.md)[]\>

Ordered list of stop suggestions (empty on script failure).
