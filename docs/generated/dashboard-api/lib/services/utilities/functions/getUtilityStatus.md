[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/utilities](../README.md) / getUtilityStatus

# Function: getUtilityStatus()

> **getUtilityStatus**(`name`): `Promise`\<[`UtilityStatus`](../../../types/interfaces/UtilityStatus.md)\>

Defined in: [lib/services/utilities.ts:66](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/utilities.ts#L66)

Query a utility's `status --json` output.

## Parameters

### name

`string`

Utility script name (without `.sh`).

## Returns

`Promise`\<[`UtilityStatus`](../../../types/interfaces/UtilityStatus.md)\>

Parsed status JSON or `{ error }` shape on script failure.

## Throws

When utility name is unknown.
