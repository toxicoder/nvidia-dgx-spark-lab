[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/nemotron-stack](../README.md) / getNemotronStackStatus

# Function: getNemotronStackStatus()

> **getNemotronStackStatus**(): `Promise`\<[`NemotronStackStatus`](../../../types/interfaces/NemotronStackStatus.md)\>

Defined in: [lib/services/nemotron-stack.ts:67](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/nemotron-stack.ts#L67)

Fetch running Nemotron stack status and pillar health.

## Returns

`Promise`\<[`NemotronStackStatus`](../../../types/interfaces/NemotronStackStatus.md)\>

Active stack id, pod counts, and pillar states.

## Throws

When `nemotron-stack.sh status` exits non-zero.
