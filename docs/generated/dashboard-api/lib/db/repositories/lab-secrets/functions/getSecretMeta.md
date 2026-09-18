[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / getSecretMeta

# Function: getSecretMeta()

> **getSecretMeta**(`id`): `Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md) \| `null`\>

Defined in: [lib/db/repositories/lab-secrets.ts:63](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/db/repositories/lab-secrets.ts#L63)

Fetch secret metadata by id without returning the encrypted value.

## Parameters

### id

`string`

## Returns

`Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md) \| `null`\>
