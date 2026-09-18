[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/utility-runs](../README.md) / recordUtilityRun

# Function: recordUtilityRun()

> **recordUtilityRun**(`input`): `Promise`\<`void`\>

Defined in: [lib/db/repositories/utility-runs.ts:8](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/db/repositories/utility-runs.ts#L8)

Persist and query utility script run history (no-op when `USE_MOCKS=1`).

## Parameters

### input

#### exitCode

`number`

#### name

`string`

#### stderr

`string`

#### stdout

`string`

## Returns

`Promise`\<`void`\>
