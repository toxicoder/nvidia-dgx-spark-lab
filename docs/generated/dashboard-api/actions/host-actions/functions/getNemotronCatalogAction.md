[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getNemotronCatalogAction

# Function: getNemotronCatalogAction()

> **getNemotronCatalogAction**(): `Promise`\<[`NemotronCatalog`](../../../lib/types/interfaces/NemotronCatalog.md)\>

Defined in: [actions/host-actions.ts:281](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/host-actions.ts#L281)

Fetch Nemotron agentic stack catalog (models, pillars, endpoints).

## Returns

`Promise`\<[`NemotronCatalog`](../../../lib/types/interfaces/NemotronCatalog.md)\>

NemotronCatalog from `nemotron-stack.sh`.

## Throws

When session is missing.
