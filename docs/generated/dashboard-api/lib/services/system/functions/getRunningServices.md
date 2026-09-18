[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/system](../README.md) / getRunningServices

# Function: getRunningServices()

> **getRunningServices**(): `Promise`\<[`RunningServices`](../../../types/interfaces/RunningServices.md)\>

Defined in: [lib/services/system.ts:36](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/system.ts#L36)

List running systemd service units (truncated).

## Returns

`Promise`\<[`RunningServices`](../../../types/interfaces/RunningServices.md)\>

Up to 15 running service unit lines.
