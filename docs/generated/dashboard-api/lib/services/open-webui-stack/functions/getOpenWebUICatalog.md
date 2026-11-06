[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/open-webui-stack](../README.md) / getOpenWebUICatalog

# Function: getOpenWebUICatalog()

> **getOpenWebUICatalog**(): `Promise`\<[`OpenWebUICatalog`](../../../types/interfaces/OpenWebUICatalog.md)\>

Defined in: [lib/services/open-webui-stack.ts:58](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/open-webui-stack.ts#L58)

Fetch Open WebUI stack catalog JSON.

## Returns

`Promise`\<[`OpenWebUICatalog`](../../../types/interfaces/OpenWebUICatalog.md)\>

Stack definitions and endpoint metadata.

## Throws

When `open-webui-stack.sh catalog` exits non-zero.
