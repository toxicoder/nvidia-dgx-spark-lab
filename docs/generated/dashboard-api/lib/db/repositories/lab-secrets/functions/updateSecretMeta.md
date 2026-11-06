[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / updateSecretMeta

# Function: updateSecretMeta()

> **updateSecretMeta**(`input`): `Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>

Defined in: [lib/db/repositories/lab-secrets.ts:153](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/db/repositories/lab-secrets.ts#L153)

Update non-value secret metadata such as description or K8s sync target.

## Parameters

### input

#### actorEmail

`string`

#### description?

`string` \| `null`

Omitted or `undefined` keeps the stored value; `null` clears it.

#### id

`string`

#### k8sSync?

[`K8sSyncTarget`](../../../../types/interfaces/K8sSyncTarget.md) \| `null`

## Returns

`Promise`\<[`LabSecretMeta`](../../../../types/interfaces/LabSecretMeta.md)\>
