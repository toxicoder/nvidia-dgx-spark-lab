[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cluster-resources](../README.md) / checkCapacity

# Function: checkCapacity()

> **checkCapacity**(`action`): `Promise`\<[`CapacityCheck`](../../../types/interfaces/CapacityCheck.md)\>

Defined in: lib/services/cluster-resources.ts:63

Check whether a planned action fits current cluster capacity.

## Parameters

### action

`string`

Capacity action token (e.g. `model:kimi`, `dev:coder`).

## Returns

`Promise`\<[`CapacityCheck`](../../../types/interfaces/CapacityCheck.md)\>

Verdict with required vs available resources.
