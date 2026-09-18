[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/nemotron-stack](../README.md) / getNemotronCatalog

# Function: getNemotronCatalog()

> **getNemotronCatalog**(): `Promise`\<[`NemotronCatalog`](../../../types/interfaces/NemotronCatalog.md)\>

Defined in: [lib/services/nemotron-stack.ts:54](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/nemotron-stack.ts#L54)

Fetch Nemotron agentic stack catalog JSON.

## Returns

`Promise`\<[`NemotronCatalog`](../../../types/interfaces/NemotronCatalog.md)\>

Stack definitions, pillars, and model endpoints.

## Throws

When `nemotron-stack.sh catalog` exits non-zero.
