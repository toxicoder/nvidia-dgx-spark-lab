[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getDevWorkspacesStatusAction

# Function: getDevWorkspacesStatusAction()

> **getDevWorkspacesStatusAction**(): `Promise`\<[`DevWorkspacesStatus`](../../../lib/types/interfaces/DevWorkspacesStatus.md)\>

Defined in: [actions/host-actions.ts:169](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/host-actions.ts#L169)

Fetch Coder and Kasm dev workspace pod/helm status.

## Returns

`Promise`\<[`DevWorkspacesStatus`](../../../lib/types/interfaces/DevWorkspacesStatus.md)\>

Combined workspace status with URLs.

## Throws

When session is missing.
