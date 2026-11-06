[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseNemotronCatalog

# Function: parseNemotronCatalog()

> **parseNemotronCatalog**(`stdout`, `utility`): [`NemotronCatalog`](../../../types/interfaces/NemotronCatalog.md)

Defined in: [lib/services/cli-json.ts:533](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L533)

Parse the Nemotron catalog.

## Parameters

### stdout

`string`

Raw stdout from `nemotron-stack.sh catalog --json`.

### utility

`string`

Utility name for diagnostics.

## Returns

[`NemotronCatalog`](../../../types/interfaces/NemotronCatalog.md)

The validated catalog.

## Throws

CliPayloadError When the payload is unusable.
