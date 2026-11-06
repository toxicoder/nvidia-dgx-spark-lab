[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getMachineStateAction

# Function: getMachineStateAction()

> **getMachineStateAction**(): `Promise`\<[`MachineState`](../../../lib/types/interfaces/MachineState.md)\>

Defined in: [actions/host-actions.ts:118](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/host-actions.ts#L118)

Aggregate host identity, running services, and installed packages.

## Returns

`Promise`\<[`MachineState`](../../../lib/types/interfaces/MachineState.md)\>

Combined [MachineState](../../../lib/types/interfaces/MachineState.md) snapshot.

## Throws

When session is missing.
