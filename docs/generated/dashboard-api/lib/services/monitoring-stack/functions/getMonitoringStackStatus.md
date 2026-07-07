[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/monitoring-stack](../README.md) / getMonitoringStackStatus

# Function: getMonitoringStackStatus()

> **getMonitoringStackStatus**(): `Promise`\<[`MonitoringStackStatus`](../../../types/interfaces/MonitoringStackStatus.md)\>

Defined in: lib/services/monitoring-stack.ts:54

Fetch Grafana/Headlamp monitoring stack status.

## Returns

`Promise`\<[`MonitoringStackStatus`](../../../types/interfaces/MonitoringStackStatus.md)\>

Per-service pod counts, URLs, and stack state.

## Throws

When `monitoring-stack.sh status` exits non-zero.
