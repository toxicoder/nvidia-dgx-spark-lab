[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / updateSecretMeta

# Function: updateSecretMeta()

> **updateSecretMeta**(`input`): `Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>

Defined in: [lib/db/repositories/lab-secrets.ts:153](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/db/repositories/lab-secrets.ts#L153)

Update non-value secret metadata such as description or K8s sync target.

## Parameters

### input

#### actorEmail

`string`

#### description?

`string` \| `null`

#### id

`string`

#### k8sSync?

[`K8sSyncTarget`](../../../../types/interfaces/K8sSyncTarget.md) \| `null`

## Returns

`Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>
