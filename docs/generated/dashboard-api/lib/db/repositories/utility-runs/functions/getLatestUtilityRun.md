[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/utility-runs](../README.md) / getLatestUtilityRun

# Function: getLatestUtilityRun()

> **getLatestUtilityRun**(`name`): `Promise`\<\{ `exit_code`: `number` \| `null`; `id`: `number`; `name`: `string`; `output`: `string` \| `null`; `started_at`: `number` \| `null`; `status`: `string` \| `null`; \} \| `undefined`\>

Defined in: [lib/db/repositories/utility-runs.ts:29](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/db/repositories/utility-runs.ts#L29)

Return the most recent utility run row for a script name.

## Parameters

### name

`string`

## Returns

`Promise`\<\{ `exit_code`: `number` \| `null`; `id`: `number`; `name`: `string`; `output`: `string` \| `null`; `started_at`: `number` \| `null`; `status`: `string` \| `null`; \} \| `undefined`\>
