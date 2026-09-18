[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/utility-runs](../README.md) / getLatestUtilityRunsByName

# Function: getLatestUtilityRunsByName()

> **getLatestUtilityRunsByName**(`names`): `Promise`\<`Map`\<`string`, \{ `exit_code`: `number` \| `null`; `id`: `number`; `name`: `string`; `output`: `string` \| `null`; `started_at`: `number` \| `null`; `status`: `string` \| `null`; \}\>\>

Defined in: [lib/db/repositories/utility-runs.ts:47](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/db/repositories/utility-runs.ts#L47)

Latest run per utility name in a single query.

## Parameters

### names

`string`[]

## Returns

`Promise`\<`Map`\<`string`, \{ `exit_code`: `number` \| `null`; `id`: `number`; `name`: `string`; `output`: `string` \| `null`; `started_at`: `number` \| `null`; `status`: `string` \| `null`; \}\>\>
