[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseCapacityCheck

# Function: parseCapacityCheck()

> **parseCapacityCheck**(`stdout`, `utility`): [`CapacityCheck`](../../../types/interfaces/CapacityCheck.md)

Defined in: [lib/services/cli-json.ts:423](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L423)

Parse a Resource Guard verdict.

## Parameters

### stdout

`string`

Raw stdout from `cluster-resources.sh check --json`.

### utility

`string`

Utility name for diagnostics.

## Returns

[`CapacityCheck`](../../../types/interfaces/CapacityCheck.md)

A verdict whose totals are always present.

## Throws

CliPayloadError When the payload is unusable. A missing `ok` or
  `verdict` is rejected rather than defaulted, so a broken gate can never read
  as "allowed".
