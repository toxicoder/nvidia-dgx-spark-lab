[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/open-webui-stack](../README.md) / getOpenWebUIStatus

# Function: getOpenWebUIStatus()

> **getOpenWebUIStatus**(): `Promise`\<[`OpenWebUIStatus`](../../../types/interfaces/OpenWebUIStatus.md)\>

Defined in: lib/services/open-webui-stack.ts:67

Fetch Open WebUI stack runtime status.

## Returns

`Promise`\<[`OpenWebUIStatus`](../../../types/interfaces/OpenWebUIStatus.md)\>

Pod readiness, URLs, and stack state.

## Throws

When `open-webui-stack.sh status` exits non-zero.
