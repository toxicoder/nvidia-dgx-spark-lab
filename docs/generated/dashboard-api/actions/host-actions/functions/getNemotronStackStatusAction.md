[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getNemotronStackStatusAction

# Function: getNemotronStackStatusAction()

> **getNemotronStackStatusAction**(): `Promise`\<[`NemotronStackStatus`](../../../lib/types/interfaces/NemotronStackStatus.md)\>

Defined in: [actions/host-actions.ts:291](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/host-actions.ts#L291)

Fetch running Nemotron stack status and pillar health.

## Returns

`Promise`\<[`NemotronStackStatus`](../../../lib/types/interfaces/NemotronStackStatus.md)\>

NemotronStackStatus from `nemotron-stack.sh`.

## Throws

When session is missing.
