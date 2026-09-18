[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / createSecret

# Function: createSecret()

> **createSecret**(`input`): `Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>

Defined in: [lib/db/repositories/lab-secrets.ts:73](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/db/repositories/lab-secrets.ts#L73)

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
