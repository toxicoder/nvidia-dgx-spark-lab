[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/docker](../README.md) / stopContainer

# Function: stopContainer()

> **stopContainer**(`id`): `Promise`\<\{ `stopped`: `string`; \}\>

Defined in: [lib/services/docker.ts:70](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/docker.ts#L70)

Stop a container by (validated) id.
Id is pre-validated; execFile avoids shell interpretation.

## Parameters

### id

`string`

## Returns

`Promise`\<\{ `stopped`: `string`; \}\>
