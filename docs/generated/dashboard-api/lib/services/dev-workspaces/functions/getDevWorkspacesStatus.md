[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/dev-workspaces](../README.md) / getDevWorkspacesStatus

# Function: getDevWorkspacesStatus()

> **getDevWorkspacesStatus**(): `Promise`\<[`DevWorkspacesStatus`](../../../types/interfaces/DevWorkspacesStatus.md)\>

Defined in: [lib/services/dev-workspaces.ts:58](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/dev-workspaces.ts#L58)

Fetch Coder and Kasm workspace pod/helm status with dashboard URLs.

## Returns

`Promise`\<[`DevWorkspacesStatus`](../../../types/interfaces/DevWorkspacesStatus.md)\>

Combined workspace status for both `coder` and `kasm`.
