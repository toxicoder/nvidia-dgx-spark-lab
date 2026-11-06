[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/nemotron-stack](../README.md) / getNemotronStackStatus

# Function: getNemotronStackStatus()

> **getNemotronStackStatus**(): `Promise`\<[`NemotronStackStatus`](../../../types/interfaces/NemotronStackStatus.md)\>

Defined in: [lib/services/nemotron-stack.ts:71](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/nemotron-stack.ts#L71)

Fetch running Nemotron stack status and pillar health.

## Returns

`Promise`\<[`NemotronStackStatus`](../../../types/interfaces/NemotronStackStatus.md)\>

Active stack id, pod counts, and pillar states.

## Throws

When `nemotron-stack.sh status` exits non-zero.
