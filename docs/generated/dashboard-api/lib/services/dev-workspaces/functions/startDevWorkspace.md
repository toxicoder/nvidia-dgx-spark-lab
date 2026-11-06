[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/dev-workspaces](../README.md) / startDevWorkspace

# Function: startDevWorkspace()

> **startDevWorkspace**(`name`): `Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Defined in: [lib/services/dev-workspaces.ts:120](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/dev-workspaces.ts#L120)

Start a dev workspace (Coder or Kasm).

## Parameters

### name

`"coder"` \| `"kasm"`

Workspace id (`coder` or `kasm`).

## Returns

`Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Script stdout, stderr, and exit code.
