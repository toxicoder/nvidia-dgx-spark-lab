[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/dev-workspaces](../README.md) / startDevWorkspace

# Function: startDevWorkspace()

> **startDevWorkspace**(`name`): `Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Defined in: [lib/services/dev-workspaces.ts:116](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/dev-workspaces.ts#L116)

Start a dev workspace (Coder or Kasm).

## Parameters

### name

[`DevWorkspaceName`](../../../types/type-aliases/DevWorkspaceName.md)

Workspace id (`coder` or `kasm`).

## Returns

`Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Script stdout, stderr, and exit code.
