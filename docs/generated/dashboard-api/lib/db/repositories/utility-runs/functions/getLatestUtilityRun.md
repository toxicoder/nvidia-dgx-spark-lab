[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/utility-runs](../README.md) / getLatestUtilityRun

# Function: getLatestUtilityRun()

> **getLatestUtilityRun**(`name`): `Promise`\<\{ `exit_code`: `number` \| `null`; `id`: `number`; `name`: `string`; `output`: `string` \| `null`; `started_at`: `number` \| `null`; `status`: `string` \| `null`; \} \| `undefined`\>

Defined in: [lib/db/repositories/utility-runs.ts:29](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/db/repositories/utility-runs.ts#L29)

Return the most recent utility run row for a script name.

## Parameters

### name

`string`

## Returns

`Promise`\<\{ `exit_code`: `number` \| `null`; `id`: `number`; `name`: `string`; `output`: `string` \| `null`; `started_at`: `number` \| `null`; `status`: `string` \| `null`; \} \| `undefined`\>
