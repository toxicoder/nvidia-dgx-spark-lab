[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / startOpenWebUIAction

# Function: startOpenWebUIAction()

> **startOpenWebUIAction**(`stackId`, `confirm?`): `Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Defined in: actions/host-actions.ts:343

Start the Open WebUI lab stack.

## Parameters

### stackId

`string`

Stack id (validated via [OpenWebUIStackIdSchema](../../../lib/validation/variables/OpenWebUIStackIdSchema.md)).

### confirm?

`string`

Optional heavy-stack confirmation (`yes`).

## Returns

`Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Utility script stdout/stderr and exit code.

## Throws

When session is missing, stackId fails validation, or confirm is invalid.
