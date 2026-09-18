[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/docker](../README.md) / stopContainer

# Function: stopContainer()

> **stopContainer**(`id`): `Promise`\<\{ `stopped`: `string`; \}\>

Defined in: [lib/services/docker.ts:70](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/docker.ts#L70)

Stop a container by (validated) id.
Id is pre-validated; execFile avoids shell interpretation.

## Parameters

### id

`string`

## Returns

`Promise`\<\{ `stopped`: `string`; \}\>
