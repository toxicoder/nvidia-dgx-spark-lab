[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/storage](../README.md) / findDuplicates

# Function: findDuplicates()

> **findDuplicates**(`targetPath?`, `minSize?`, `options?`): `Promise`\<[`DuplicateFindResult`](../../../types/interfaces/DuplicateFindResult.md)\>

Defined in: [lib/services/storage.ts:109](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/storage.ts#L109)

Scan for duplicate files grouped by exact byte size.

## Parameters

### targetPath?

`string` = `"/mnt/models"`

Root path to scan (default `/mnt/models`).

### minSize?

`number` = `...`

Minimum file size in bytes (default 10 MiB).

### options?

Optional `{ empty: true }` for visual-test empty fixture.

#### empty?

`boolean`

## Returns

`Promise`\<[`DuplicateFindResult`](../../../types/interfaces/DuplicateFindResult.md)\>

Groups of files sharing the same size.

## Throws

When path is outside lab whitelist bases.
