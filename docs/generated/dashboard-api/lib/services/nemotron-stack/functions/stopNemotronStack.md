[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/nemotron-stack](../README.md) / stopNemotronStack

# Function: stopNemotronStack()

> **stopNemotronStack**(`stackId`): `Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Defined in: lib/services/nemotron-stack.ts:93

Stop a Nemotron agentic stack (or `all`).

## Parameters

### stackId

`string`

Stack id or `all`.

## Returns

`Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Script stdout, stderr, and exit code.
