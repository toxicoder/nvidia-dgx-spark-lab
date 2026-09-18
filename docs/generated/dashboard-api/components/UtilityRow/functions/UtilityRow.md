[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [components/UtilityRow](../README.md) / UtilityRow

# Function: UtilityRow()

> **UtilityRow**(`__namedParameters`): `Element`

Defined in: [components/UtilityRow.tsx:18](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/components/UtilityRow.tsx#L18)

Runs or queries a utility script and shows structured output in a slide-over sheet.

## Parameters

### \_\_namedParameters

#### lastRun?

\{ `exit_code`: `number` \| `null`; `id`: `number`; `name`: `string`; `output`: `string` \| `null`; `started_at`: `number` \| `null`; `status`: `string` \| `null`; \} \| `null`

#### utility

\{ `name`: `string`; `path`: `string`; \}

#### utility.name

`string`

#### utility.path

`string`

## Returns

`Element`
