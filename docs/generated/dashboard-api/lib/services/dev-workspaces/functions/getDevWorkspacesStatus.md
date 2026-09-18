[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/dev-workspaces](../README.md) / getDevWorkspacesStatus

# Function: getDevWorkspacesStatus()

> **getDevWorkspacesStatus**(): `Promise`\<[`DevWorkspacesStatus`](../../../types/interfaces/DevWorkspacesStatus.md)\>

Defined in: [lib/services/dev-workspaces.ts:54](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/dev-workspaces.ts#L54)

Fetch Coder and Kasm workspace pod/helm status with dashboard URLs.

## Returns

`Promise`\<[`DevWorkspacesStatus`](../../../types/interfaces/DevWorkspacesStatus.md)\>

Combined workspace status for both `coder` and `kasm`.
