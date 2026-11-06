[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / startDevWorkspaceAction

# Function: startDevWorkspaceAction()

> **startDevWorkspaceAction**(`name`): `Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Defined in: [actions/host-actions.ts:180](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/host-actions.ts#L180)

Start a dev workspace (Coder or Kasm).

## Parameters

### name

`string`

Workspace id (`coder` or `kasm`).

## Returns

`Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Utility script stdout/stderr and exit code.

## Throws

When session is missing or name fails validation.
