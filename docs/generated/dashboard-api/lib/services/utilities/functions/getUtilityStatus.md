[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/utilities](../README.md) / getUtilityStatus

# Function: getUtilityStatus()

> **getUtilityStatus**(`name`): `Promise`\<[`UtilityStatus`](../../../types/interfaces/UtilityStatus.md)\>

Defined in: [lib/services/utilities.ts:65](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/utilities.ts#L65)

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
