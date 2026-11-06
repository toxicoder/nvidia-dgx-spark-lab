[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / stopNemotronStackAction

# Function: stopNemotronStackAction()

> **stopNemotronStackAction**(`stackId`): `Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Defined in: [actions/host-actions.ts:318](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/host-actions.ts#L318)

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
