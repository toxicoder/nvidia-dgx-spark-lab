[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / deleteSecret

# Function: deleteSecret()

> **deleteSecret**(`id`, `actorEmail`): `Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>

Defined in: [lib/db/repositories/lab-secrets.ts:191](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/db/repositories/lab-secrets.ts#L191)

Delete a secret and record a delete audit event.

## Parameters

### id

`string`

### actorEmail

`string`

## Returns

`Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>
