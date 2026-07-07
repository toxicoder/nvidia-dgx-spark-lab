[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / stopDevWorkspaceAction

# Function: stopDevWorkspaceAction()

> **stopDevWorkspaceAction**(`name`): `Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Defined in: actions/host-actions.ts:194

Stop a dev workspace (Coder or Kasm).

## Parameters

### name

`string`

Workspace id (`coder` or `kasm`).

## Returns

`Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Utility script stdout/stderr and exit code.

## Throws

When session is missing or name fails validation.
