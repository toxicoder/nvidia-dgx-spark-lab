[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseDevWorkspacesStatus

# Function: parseDevWorkspacesStatus()

> **parseDevWorkspacesStatus**(`stdout`, `utility`): [`DevWorkspacesStatus`](../../../types/interfaces/DevWorkspacesStatus.md)

Defined in: [lib/services/cli-json.ts:500](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L500)

Parse the dev workspace status.

## Parameters

### stdout

`string`

Raw stdout from `dev-workspaces.sh status --json`.

### utility

`string`

Utility name for diagnostics.

## Returns

[`DevWorkspacesStatus`](../../../types/interfaces/DevWorkspacesStatus.md)

The validated status payload.

## Throws

CliPayloadError When either workspace row is missing or malformed.
