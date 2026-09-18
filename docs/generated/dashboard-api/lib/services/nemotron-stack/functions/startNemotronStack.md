[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/nemotron-stack](../README.md) / startNemotronStack

# Function: startNemotronStack()

> **startNemotronStack**(`stackId`, `confirm`): `Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Defined in: [lib/services/nemotron-stack.ts:81](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/nemotron-stack.ts#L81)

Start a Nemotron agentic stack.

## Parameters

### stackId

`string`

Stack id to deploy.

### confirm

`string`

Heavy-stack confirmation (`yes`).

## Returns

`Promise`\<\{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Script stdout, stderr, and exit code.
