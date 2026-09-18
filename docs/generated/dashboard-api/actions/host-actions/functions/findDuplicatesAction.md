[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / findDuplicatesAction

# Function: findDuplicatesAction()

> **findDuplicatesAction**(`path?`): `Promise`\<[`DuplicateFindResult`](../../../lib/types/interfaces/DuplicateFindResult.md)\>

Defined in: [actions/host-actions.ts:130](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/host-actions.ts#L130)

Find duplicate files by size under a storage path.

## Parameters

### path?

`string`

Optional root path; defaults to `/mnt/models`.

## Returns

`Promise`\<[`DuplicateFindResult`](../../../lib/types/interfaces/DuplicateFindResult.md)\>

Groups of files sharing the same size above the minimum threshold.

## Throws

When session is missing or path fails validation.
