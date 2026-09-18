[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getMonitoringStackStatusAction

# Function: getMonitoringStackStatusAction()

> **getMonitoringStackStatusAction**(): `Promise`\<[`MonitoringStackStatus`](../../../lib/types/interfaces/MonitoringStackStatus.md)\>

Defined in: [actions/host-actions.ts:369](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/host-actions.ts#L369)

Fetch Grafana/Headlamp monitoring stack status.

## Returns

`Promise`\<[`MonitoringStackStatus`](../../../lib/types/interfaces/MonitoringStackStatus.md)\>

MonitoringStackStatus from `monitoring-stack.sh`.

## Throws

When session is missing.
