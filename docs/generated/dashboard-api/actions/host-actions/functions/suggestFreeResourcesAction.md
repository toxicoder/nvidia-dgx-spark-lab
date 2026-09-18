[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / suggestFreeResourcesAction

# Function: suggestFreeResourcesAction()

> **suggestFreeResourcesAction**(`action`): `Promise`\<[`FreeResourceSuggestion`](../../../lib/types/interfaces/FreeResourceSuggestion.md)[]\>

Defined in: [actions/host-actions.ts:230](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/host-actions.ts#L230)

Suggest workloads to stop in order to free resources for an action.

## Parameters

### action

`string`

Capacity action token (e.g. `stack:nemotron-agentic-spark-1`).

## Returns

`Promise`\<[`FreeResourceSuggestion`](../../../lib/types/interfaces/FreeResourceSuggestion.md)[]\>

Ordered list of stop suggestions.

## Throws

When session is missing or action token fails validation.
