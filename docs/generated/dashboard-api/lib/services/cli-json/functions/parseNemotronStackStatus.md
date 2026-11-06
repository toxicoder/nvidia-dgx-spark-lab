[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseNemotronStackStatus

# Function: parseNemotronStackStatus()

> **parseNemotronStackStatus**(`stdout`, `utility`): [`NemotronStackStatus`](../../../types/interfaces/NemotronStackStatus.md)

Defined in: [lib/services/cli-json.ts:544](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L544)

Parse the Nemotron stack health.

## Parameters

### stdout

`string`

Raw stdout from `nemotron-stack.sh status --json`.

### utility

`string`

Utility name for diagnostics.

## Returns

[`NemotronStackStatus`](../../../types/interfaces/NemotronStackStatus.md)

The validated health payload.

## Throws

CliPayloadError When the payload is unusable.
