[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/dev-workspaces](../README.md) / stopDevWorkspace

# Function: stopDevWorkspace()

> **stopDevWorkspace**(`name`): `Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Defined in: lib/services/dev-workspaces.ts:145

Stop a dev workspace (Coder or Kasm).

## Parameters

### name

[`DevWorkspaceName`](../../../types/type-aliases/DevWorkspaceName.md)

Workspace id (`coder` or `kasm`).

## Returns

`Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Script stdout, stderr, and exit code.
