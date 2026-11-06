[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/open-webui-stack](../README.md) / getOpenWebUIStatus

# Function: getOpenWebUIStatus()

> **getOpenWebUIStatus**(): `Promise`\<[`OpenWebUIStatus`](../../../types/interfaces/OpenWebUIStatus.md)\>

Defined in: [lib/services/open-webui-stack.ts:71](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/open-webui-stack.ts#L71)

Fetch Open WebUI stack runtime status.

## Returns

`Promise`\<[`OpenWebUIStatus`](../../../types/interfaces/OpenWebUIStatus.md)\>

Pod readiness, URLs, and stack state.

## Throws

When `open-webui-stack.sh status` exits non-zero.
