[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cluster-resources](../README.md) / suggestFreeResources

# Function: suggestFreeResources()

> **suggestFreeResources**(`action`): `Promise`\<[`FreeResourceSuggestion`](../../../types/interfaces/FreeResourceSuggestion.md)[]\>

Defined in: [lib/services/cluster-resources.ts:102](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cluster-resources.ts#L102)

Suggest workloads to stop in order to free resources for an action.

## Parameters

### action

`string`

Capacity action token.

## Returns

`Promise`\<[`FreeResourceSuggestion`](../../../types/interfaces/FreeResourceSuggestion.md)[]\>

Ordered list of stop suggestions (empty on script failure).
