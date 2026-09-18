[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/open-webui-stack](../README.md) / getOpenWebUICatalog

# Function: getOpenWebUICatalog()

> **getOpenWebUICatalog**(): `Promise`\<[`OpenWebUICatalog`](../../../types/interfaces/OpenWebUICatalog.md)\>

Defined in: [lib/services/open-webui-stack.ts:54](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/open-webui-stack.ts#L54)

Fetch Open WebUI stack catalog JSON.

## Returns

`Promise`\<[`OpenWebUICatalog`](../../../types/interfaces/OpenWebUICatalog.md)\>

Stack definitions and endpoint metadata.

## Throws

When `open-webui-stack.sh catalog` exits non-zero.
