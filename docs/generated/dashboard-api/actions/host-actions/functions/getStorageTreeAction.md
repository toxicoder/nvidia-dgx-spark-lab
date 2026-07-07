[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getStorageTreeAction

# Function: getStorageTreeAction()

> **getStorageTreeAction**(`input`): `Promise`\<[`TreeNode`](../../../lib/types/interfaces/TreeNode.md)\>

Defined in: actions/host-actions.ts:89

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
