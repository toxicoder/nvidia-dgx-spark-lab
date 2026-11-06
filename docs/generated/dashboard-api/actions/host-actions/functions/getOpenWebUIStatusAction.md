[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getOpenWebUIStatusAction

# Function: getOpenWebUIStatusAction()

> **getOpenWebUIStatusAction**(): `Promise`\<[`OpenWebUIStatus`](../../../lib/types/interfaces/OpenWebUIStatus.md)\>

Defined in: [actions/host-actions.ts:331](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/host-actions.ts#L331)

Fetch Open WebUI stack status (pods, URLs).

## Returns

`Promise`\<[`OpenWebUIStatus`](../../../lib/types/interfaces/OpenWebUIStatus.md)\>

OpenWebUIStatus from `open-webui-stack.sh`.

## Throws

When session is missing.
