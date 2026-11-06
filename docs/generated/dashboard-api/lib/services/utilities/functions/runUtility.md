[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/utilities](../README.md) / runUtility

# Function: runUtility()

> **runUtility**(`name`, `args?`): `Promise`\<[`UtilityRunResult`](../../../types/interfaces/UtilityRunResult.md)\>

Defined in: [lib/services/utilities.ts:91](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/utilities.ts#L91)

Execute a utility script and persist the run to SQLite.

## Parameters

### name

`string`

Utility script name (without `.sh`).

### args?

`string`[] = `[]`

CLI args; defaults to `["run"]` when empty.

## Returns

`Promise`\<[`UtilityRunResult`](../../../types/interfaces/UtilityRunResult.md)\>

Captured stdout, stderr, and exit code.

## Throws

When utility name is unknown.
