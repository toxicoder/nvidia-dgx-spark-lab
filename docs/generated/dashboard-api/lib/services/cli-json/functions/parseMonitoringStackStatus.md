[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseMonitoringStackStatus

# Function: parseMonitoringStackStatus()

> **parseMonitoringStackStatus**(`stdout`, `utility`): [`MonitoringStackStatus`](../../../types/interfaces/MonitoringStackStatus.md)

Defined in: [lib/services/cli-json.ts:511](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L511)

Parse the monitoring stack status.

## Parameters

### stdout

`string`

Raw stdout from `monitoring-stack.sh status --json`.

### utility

`string`

Utility name for diagnostics.

## Returns

[`MonitoringStackStatus`](../../../types/interfaces/MonitoringStackStatus.md)

The validated status payload.

## Throws

CliPayloadError When the payload is unusable.
