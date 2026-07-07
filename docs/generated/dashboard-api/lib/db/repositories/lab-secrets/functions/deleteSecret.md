[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / deleteSecret

# Function: deleteSecret()

> **deleteSecret**(`id`, `actorEmail`): `Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>

Defined in: lib/db/repositories/lab-secrets.ts:190

Delete a secret and record a delete audit event.

## Parameters

### id

`string`

### actorEmail

`string`

## Returns

`Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>
