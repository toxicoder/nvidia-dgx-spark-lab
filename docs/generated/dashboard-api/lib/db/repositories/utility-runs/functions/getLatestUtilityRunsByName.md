[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/utility-runs](../README.md) / getLatestUtilityRunsByName

# Function: getLatestUtilityRunsByName()

> **getLatestUtilityRunsByName**(`names`): `Promise`\<`Map`\<`string`, \{ `exit_code`: `number` \| `null`; `id`: `number`; `name`: `string`; `output`: `string` \| `null`; `started_at`: `number` \| `null`; `status`: `string` \| `null`; \}\>\>

Defined in: lib/db/repositories/utility-runs.ts:47

Latest run per utility name in a single query.

## Parameters

### names

`string`[]

## Returns

`Promise`\<`Map`\<`string`, \{ `exit_code`: `number` \| `null`; `id`: `number`; `name`: `string`; `output`: `string` \| `null`; `started_at`: `number` \| `null`; `status`: `string` \| `null`; \}\>\>
