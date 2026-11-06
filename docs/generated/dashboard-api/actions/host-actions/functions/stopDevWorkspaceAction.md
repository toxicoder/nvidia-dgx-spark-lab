[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / stopDevWorkspaceAction

# Function: stopDevWorkspaceAction()

> **stopDevWorkspaceAction**(`name`): `Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Defined in: [actions/host-actions.ts:194](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/host-actions.ts#L194)

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
