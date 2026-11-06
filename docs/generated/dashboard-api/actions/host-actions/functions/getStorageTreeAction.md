[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getStorageTreeAction

# Function: getStorageTreeAction()

> **getStorageTreeAction**(`input`): `Promise`\<[`TreeNode`](../../../lib/types/interfaces/TreeNode.md)\>

Defined in: [actions/host-actions.ts:89](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/host-actions.ts#L89)

Fetch a storage directory tree for treemap visualization.

## Parameters

### input

Optional root path; defaults to `/mnt/models`.

#### path?

`string`

## Returns

`Promise`\<[`TreeNode`](../../../lib/types/interfaces/TreeNode.md)\>

Hierarchical [TreeNode](../../../lib/types/interfaces/TreeNode.md) for the requested path.

## Throws

When session is missing or path fails whitelist validation.
