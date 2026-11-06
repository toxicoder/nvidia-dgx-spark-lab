[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / updateSecretValue

# Function: updateSecretValue()

> **updateSecretValue**(`input`): `Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>

Defined in: [lib/db/repositories/lab-secrets.ts:121](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/db/repositories/lab-secrets.ts#L121)

Rotate the encrypted value for an existing secret.

## Parameters

### input

#### actorEmail

`string`

#### id

`string`

#### value

`string`

## Returns

`Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>
