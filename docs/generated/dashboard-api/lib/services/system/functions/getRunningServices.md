[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/system](../README.md) / getRunningServices

# Function: getRunningServices()

> **getRunningServices**(): `Promise`\<[`RunningServices`](../../../types/interfaces/RunningServices.md)\>

Defined in: [lib/services/system.ts:36](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/system.ts#L36)

List running systemd service units (truncated).

## Returns

`Promise`\<[`RunningServices`](../../../types/interfaces/RunningServices.md)\>

Up to 15 running service unit lines.
