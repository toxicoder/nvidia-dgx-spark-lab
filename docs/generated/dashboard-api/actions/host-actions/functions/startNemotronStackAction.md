[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / startNemotronStackAction

# Function: startNemotronStackAction()

> **startNemotronStackAction**(`stackId`, `confirm?`): `Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Defined in: [actions/host-actions.ts:303](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/host-actions.ts#L303)

Start a Nemotron agentic stack.

## Parameters

### stackId

`string`

Stack id (validated via [NemotronStackIdSchema](../../../lib/validation/variables/NemotronStackIdSchema.md)).

### confirm?

`string`

Optional heavy-stack confirmation (`yes`).

## Returns

`Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Utility script stdout/stderr and exit code.

## Throws

When session is missing, stackId fails validation, or confirm is invalid.
