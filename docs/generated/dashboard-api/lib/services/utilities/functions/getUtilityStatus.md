[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/utilities](../README.md) / getUtilityStatus

# Function: getUtilityStatus()

> **getUtilityStatus**(`name`): `Promise`\<[`UtilityStatus`](../../../types/interfaces/UtilityStatus.md)\>

Defined in: lib/services/utilities.ts:65

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
