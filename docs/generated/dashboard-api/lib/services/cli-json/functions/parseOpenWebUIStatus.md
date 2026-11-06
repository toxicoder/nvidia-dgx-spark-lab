[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseOpenWebUIStatus

# Function: parseOpenWebUIStatus()

> **parseOpenWebUIStatus**(`stdout`, `utility`): [`OpenWebUIStatus`](../../../types/interfaces/OpenWebUIStatus.md)

Defined in: [lib/services/cli-json.ts:566](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L566)

Parse the Open WebUI status.

## Parameters

### stdout

`string`

Raw stdout from `open-webui-stack.sh status --json`.

### utility

`string`

Utility name for diagnostics.

## Returns

[`OpenWebUIStatus`](../../../types/interfaces/OpenWebUIStatus.md)

The validated status payload.

## Throws

CliPayloadError When the payload is unusable.
