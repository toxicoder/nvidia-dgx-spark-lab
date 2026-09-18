[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/open-webui-stack](../README.md) / getOpenWebUIStatus

# Function: getOpenWebUIStatus()

> **getOpenWebUIStatus**(): `Promise`\<[`OpenWebUIStatus`](../../../types/interfaces/OpenWebUIStatus.md)\>

Defined in: [lib/services/open-webui-stack.ts:67](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/open-webui-stack.ts#L67)

Fetch Open WebUI stack runtime status.

## Returns

`Promise`\<[`OpenWebUIStatus`](../../../types/interfaces/OpenWebUIStatus.md)\>

Pod readiness, URLs, and stack state.

## Throws

When `open-webui-stack.sh status` exits non-zero.
