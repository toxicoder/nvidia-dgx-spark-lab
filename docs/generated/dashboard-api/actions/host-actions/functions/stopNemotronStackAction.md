[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / stopNemotronStackAction

# Function: stopNemotronStackAction()

> **stopNemotronStackAction**(`stackId`): `Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Defined in: actions/host-actions.ts:318

Stop a Nemotron agentic stack or all stacks.

## Parameters

### stackId

`string`

Stack id or `all`.

## Returns

`Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Utility script stdout/stderr and exit code.

## Throws

When session is missing or stackId fails validation.
