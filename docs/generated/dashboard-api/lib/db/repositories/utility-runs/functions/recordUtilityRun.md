[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/utility-runs](../README.md) / recordUtilityRun

# Function: recordUtilityRun()

> **recordUtilityRun**(`input`): `Promise`\<`void`\>

Defined in: lib/db/repositories/utility-runs.ts:8

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
