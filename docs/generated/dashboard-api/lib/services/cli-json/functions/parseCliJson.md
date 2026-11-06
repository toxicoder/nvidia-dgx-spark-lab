[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseCliJson

# Function: parseCliJson()

> **parseCliJson**\<`T`\>(`schema`, `stdout`, `utility`): `T`

Defined in: [lib/services/cli-json.ts:399](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L399)

Parse one JSON document from a utility, proving it matches `schema`.

## Type Parameters

### T

`T`

## Parameters

### schema

`ZodType`\<`T`\>

The shape the caller needs.

### stdout

`string`

Raw stdout from the utility.

### utility

`string`

Utility name, used in the error message.

## Returns

`T`

The validated payload.

## Throws

CliPayloadError When `stdout` is not JSON, or is JSON of the wrong shape.
