[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseFreeResourceSuggestions

# Function: parseFreeResourceSuggestions()

> **parseFreeResourceSuggestions**(`stdout`, `utility`): [`FreeResourceSuggestion`](../../../types/interfaces/FreeResourceSuggestion.md)[]

Defined in: [lib/services/cli-json.ts:445](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L445)

Parse the free-resource suggestions list.

## Parameters

### stdout

`string`

Raw stdout from `cluster-resources.sh suggest --json`.

### utility

`string`

Utility name for diagnostics.

## Returns

[`FreeResourceSuggestion`](../../../types/interfaces/FreeResourceSuggestion.md)[]

One row per applicable suggestion.

## Throws

CliPayloadError When the payload is unusable.
