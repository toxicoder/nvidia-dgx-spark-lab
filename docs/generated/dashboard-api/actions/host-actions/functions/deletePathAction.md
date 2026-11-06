[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / deletePathAction

# Function: deletePathAction()

> **deletePathAction**(`formData`): `Promise`\<\{ `movedToTrash`: `string`; \}\>

Defined in: [actions/host-actions.ts:103](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/host-actions.ts#L103)

Move a whitelisted path to lab trash (safe delete).

## Parameters

### formData

`FormData`

Must include a `path` field.

## Returns

`Promise`\<\{ `movedToTrash`: `string`; \}\>

Trash location where the item was moved.

## Throws

When session is missing or path fails validation.
