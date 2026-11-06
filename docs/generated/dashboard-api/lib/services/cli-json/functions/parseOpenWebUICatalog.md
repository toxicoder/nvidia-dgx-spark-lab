[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseOpenWebUICatalog

# Function: parseOpenWebUICatalog()

> **parseOpenWebUICatalog**(`stdout`, `utility`): [`OpenWebUICatalog`](../../../types/interfaces/OpenWebUICatalog.md)

Defined in: [lib/services/cli-json.ts:555](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L555)

Parse the Open WebUI catalog.

## Parameters

### stdout

`string`

Raw stdout from `open-webui-stack.sh catalog --json`.

### utility

`string`

Utility name for diagnostics.

## Returns

[`OpenWebUICatalog`](../../../types/interfaces/OpenWebUICatalog.md)

The validated catalog.

## Throws

CliPayloadError When the payload is unusable.
