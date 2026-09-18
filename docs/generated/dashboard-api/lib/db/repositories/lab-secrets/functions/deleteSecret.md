[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / deleteSecret

# Function: deleteSecret()

> **deleteSecret**(`id`, `actorEmail`): `Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>

Defined in: [lib/db/repositories/lab-secrets.ts:190](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/db/repositories/lab-secrets.ts#L190)

Delete a secret and record a delete audit event.

## Parameters

### id

`string`

### actorEmail

`string`

## Returns

`Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>
