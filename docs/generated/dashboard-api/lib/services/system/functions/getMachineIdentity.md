[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/system](../README.md) / getMachineIdentity

# Function: getMachineIdentity()

> **getMachineIdentity**(): `Promise`\<[`MachineIdentity`](../../../types/interfaces/MachineIdentity.md)\>

Defined in: lib/services/system.ts:17

Read host identity and primary GPU driver info.

## Returns

`Promise`\<[`MachineIdentity`](../../../types/interfaces/MachineIdentity.md)\>

Hostname and first `nvidia-smi` GPU line (or fallback message).
