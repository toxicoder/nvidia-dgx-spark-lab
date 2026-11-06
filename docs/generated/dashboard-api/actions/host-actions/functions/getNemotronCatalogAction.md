[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getNemotronCatalogAction

# Function: getNemotronCatalogAction()

> **getNemotronCatalogAction**(): `Promise`\<[`NemotronCatalog`](../../../lib/types/interfaces/NemotronCatalog.md)\>

Defined in: [actions/host-actions.ts:281](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/host-actions.ts#L281)

Fetch Nemotron agentic stack catalog (models, pillars, endpoints).

## Returns

`Promise`\<[`NemotronCatalog`](../../../lib/types/interfaces/NemotronCatalog.md)\>

NemotronCatalog from `nemotron-stack.sh`.

## Throws

When session is missing.
