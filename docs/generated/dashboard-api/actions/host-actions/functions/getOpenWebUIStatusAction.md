[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getOpenWebUIStatusAction

# Function: getOpenWebUIStatusAction()

> **getOpenWebUIStatusAction**(): `Promise`\<[`OpenWebUIStatus`](../../../lib/types/interfaces/OpenWebUIStatus.md)\>

Defined in: [actions/host-actions.ts:331](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/host-actions.ts#L331)

Fetch Open WebUI stack status (pods, URLs).

## Returns

`Promise`\<[`OpenWebUIStatus`](../../../lib/types/interfaces/OpenWebUIStatus.md)\>

OpenWebUIStatus from `open-webui-stack.sh`.

## Throws

When session is missing.
