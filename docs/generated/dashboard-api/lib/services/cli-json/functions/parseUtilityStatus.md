[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseUtilityStatus

# Function: parseUtilityStatus()

> **parseUtilityStatus**(`stdout`, `utility`): [`UtilityStatus`](../../../types/interfaces/UtilityStatus.md)

Defined in: [lib/services/cli-json.ts:522](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L522)

Parse a utility's generic `status --json` document.

## Parameters

### stdout

`string`

Raw stdout from `<utility> status --json`.

### utility

`string`

Utility name for diagnostics.

## Returns

[`UtilityStatus`](../../../types/interfaces/UtilityStatus.md)

The validated document, utility-specific keys included.

## Throws

CliPayloadError When one of the four contract keys holds the wrong type.
