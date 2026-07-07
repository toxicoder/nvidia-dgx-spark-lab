[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / suggestFreeResourcesAction

# Function: suggestFreeResourcesAction()

> **suggestFreeResourcesAction**(`action`): `Promise`\<[`FreeResourceSuggestion`](../../../lib/types/interfaces/FreeResourceSuggestion.md)[]\>

Defined in: actions/host-actions.ts:230

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
