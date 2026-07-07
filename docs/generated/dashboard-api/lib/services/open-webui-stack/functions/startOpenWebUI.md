[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/open-webui-stack](../README.md) / startOpenWebUI

# Function: startOpenWebUI()

> **startOpenWebUI**(`stackId`, `confirm`): `Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Defined in: lib/services/open-webui-stack.ts:81

Start an Open WebUI stack deployment.

## Parameters

### stackId

`string`

Stack id to start.

### confirm

`string`

Heavy-stack confirmation (`yes`).

## Returns

`Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Script stdout, stderr, and exit code.
