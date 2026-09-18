[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / updateSecretValue

# Function: updateSecretValue()

> **updateSecretValue**(`input`): `Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>

Defined in: [lib/db/repositories/lab-secrets.ts:121](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/db/repositories/lab-secrets.ts#L121)

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
