[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cluster-resources](../README.md) / checkCapacity

# Function: checkCapacity()

> **checkCapacity**(`action`): `Promise`\<[`CapacityCheck`](../../../types/interfaces/CapacityCheck.md)\>

Defined in: [lib/services/cluster-resources.ts:67](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cluster-resources.ts#L67)

Check whether a planned action fits current cluster capacity.

## Parameters

### action

`string`

Capacity action token (e.g. `model:kimi`, `dev:coder`).

## Returns

`Promise`\<[`CapacityCheck`](../../../types/interfaces/CapacityCheck.md)\>

Verdict with required vs available resources.
