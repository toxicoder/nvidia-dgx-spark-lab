[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/dev-workspaces](../README.md) / getDevWorkspacesStatus

# Function: getDevWorkspacesStatus()

> **getDevWorkspacesStatus**(): `Promise`\<[`DevWorkspacesStatus`](../../../types/interfaces/DevWorkspacesStatus.md)\>

Defined in: lib/services/dev-workspaces.ts:54

Fetch Coder and Kasm workspace pod/helm status with dashboard URLs.

## Returns

`Promise`\<[`DevWorkspacesStatus`](../../../types/interfaces/DevWorkspacesStatus.md)\>

Combined workspace status for both `coder` and `kasm`.
