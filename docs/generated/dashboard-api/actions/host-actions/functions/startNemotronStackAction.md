[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / startNemotronStackAction

# Function: startNemotronStackAction()

> **startNemotronStackAction**(`stackId`, `confirm?`): `Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Defined in: [actions/host-actions.ts:303](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/host-actions.ts#L303)

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
