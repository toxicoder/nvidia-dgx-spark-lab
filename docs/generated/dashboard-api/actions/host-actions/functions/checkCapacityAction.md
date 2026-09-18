[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / checkCapacityAction

# Function: checkCapacityAction()

> **checkCapacityAction**(`action`): `Promise`\<[`CapacityCheck`](../../../lib/types/interfaces/CapacityCheck.md)\>

Defined in: [actions/host-actions.ts:218](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/host-actions.ts#L218)

Check whether a planned action fits current cluster capacity.

## Parameters

### action

`string`

Capacity action token (e.g. `model:kimi`, `dev:coder`).

## Returns

`Promise`\<[`CapacityCheck`](../../../lib/types/interfaces/CapacityCheck.md)\>

Verdict with required vs available resources.

## Throws

When session is missing or action token fails validation.
