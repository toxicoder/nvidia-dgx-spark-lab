[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/storage](../README.md) / deletePath

# Function: deletePath()

> **deletePath**(`target`): `Promise`\<\{ `movedToTrash`: `string`; \}\>

Defined in: lib/services/storage.ts:87

Move a whitelisted path to lab trash (safe delete, not permanent rm).

## Parameters

### target

`string`

Absolute path to move.

## Returns

`Promise`\<\{ `movedToTrash`: `string`; \}\>

Trash directory where the item was relocated.

## Throws

When path is outside lab whitelist bases.
