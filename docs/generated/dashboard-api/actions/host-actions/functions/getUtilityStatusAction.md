[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getUtilityStatusAction

# Function: getUtilityStatusAction()

> **getUtilityStatusAction**(`name`): `Promise`\<[`UtilityStatus`](../../../lib/types/interfaces/UtilityStatus.md)\>

Defined in: actions/host-actions.ts:142

Query status JSON for a lab utility script.

## Parameters

### name

`string`

Utility script name (without `.sh`).

## Returns

`Promise`\<[`UtilityStatus`](../../../lib/types/interfaces/UtilityStatus.md)\>

Parsed status object or error shape from the utility.

## Throws

When session is missing or name is not in the allowlist.
