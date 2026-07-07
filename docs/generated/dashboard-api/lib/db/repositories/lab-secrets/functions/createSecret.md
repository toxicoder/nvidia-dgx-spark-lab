[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / createSecret

# Function: createSecret()

> **createSecret**(`input`): `Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>

Defined in: lib/db/repositories/lab-secrets.ts:73

Create a new encrypted secret and record a create audit event.

## Parameters

### input

#### actorEmail

`string`

#### category

[`SecretCategory`](../../../../types/type-aliases/SecretCategory.md)

#### description?

`string`

#### k8sSync?

[`K8sSyncTarget`](../../../../types/interfaces/K8sSyncTarget.md)

#### name

`string`

#### value

`string`

## Returns

`Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>
