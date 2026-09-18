[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / deletePathAction

# Function: deletePathAction()

> **deletePathAction**(`formData`): `Promise`\<\{ `movedToTrash`: `string`; \}\>

Defined in: [actions/host-actions.ts:103](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/host-actions.ts#L103)

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
