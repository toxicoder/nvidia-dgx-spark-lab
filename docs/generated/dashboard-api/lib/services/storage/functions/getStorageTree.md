[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/storage](../README.md) / getStorageTree

# Function: getStorageTree()

> **getStorageTree**(`targetPath?`, `maxDepth?`): `Promise`\<[`TreeNode`](../../../types/interfaces/TreeNode.md)\>

Defined in: [lib/services/storage.ts:27](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/storage.ts#L27)

Build a size-annotated directory tree for treemap visualization.

## Parameters

### targetPath?

`string` = `"/mnt/models"`

Root path (must pass whitelist check).

### maxDepth?

`number` = `3`

Maximum recursion depth (default 3).

## Returns

`Promise`\<[`TreeNode`](../../../types/interfaces/TreeNode.md)\>

TreeNode hierarchy sorted by size descending.

## Throws

When path is outside lab whitelist bases.
