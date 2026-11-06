[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / getSecretMeta

# Function: getSecretMeta()

> **getSecretMeta**(`id`): `Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md) \| `null`\>

Defined in: [lib/db/repositories/lab-secrets.ts:63](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/db/repositories/lab-secrets.ts#L63)

Fetch secret metadata by id without returning the encrypted value.

## Parameters

### id

`string`

## Returns

`Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md) \| `null`\>
