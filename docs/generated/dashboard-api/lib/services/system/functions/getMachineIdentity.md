[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/system](../README.md) / getMachineIdentity

# Function: getMachineIdentity()

> **getMachineIdentity**(): `Promise`\<[`MachineIdentity`](../../../types/interfaces/MachineIdentity.md)\>

Defined in: [lib/services/system.ts:17](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/system.ts#L17)

Read host identity and primary GPU driver info.

## Returns

`Promise`\<[`MachineIdentity`](../../../types/interfaces/MachineIdentity.md)\>

Hostname and first `nvidia-smi` GPU line (or fallback message).
