[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/nemotron-stack](../README.md) / getNemotronStackStatus

# Function: getNemotronStackStatus()

> **getNemotronStackStatus**(): `Promise`\<[`NemotronStackStatus`](../../../types/interfaces/NemotronStackStatus.md)\>

Defined in: lib/services/nemotron-stack.ts:67

Fetch running Nemotron stack status and pillar health.

## Returns

`Promise`\<[`NemotronStackStatus`](../../../types/interfaces/NemotronStackStatus.md)\>

Active stack id, pod counts, and pillar states.

## Throws

When `nemotron-stack.sh status` exits non-zero.
