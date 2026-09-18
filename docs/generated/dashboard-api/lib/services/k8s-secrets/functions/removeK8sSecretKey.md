[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/k8s-secrets](../README.md) / removeK8sSecretKey

# Function: removeK8sSecretKey()

> **removeK8sSecretKey**(`target`): `Promise`\<[`K8sSecretSyncResult`](../interfaces/K8sSecretSyncResult.md)\>

Defined in: [lib/services/k8s-secrets.ts:92](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/k8s-secrets.ts#L92)

Remove a key from a synced secret; delete the Secret if empty.

## Parameters

### target

[`K8sSyncTarget`](../../../types/interfaces/K8sSyncTarget.md)

Namespace, secret name, and key to remove.

## Returns

`Promise`\<[`K8sSecretSyncResult`](../interfaces/K8sSecretSyncResult.md)\>

`{ ok: true }` or `{ ok: false, error }` on kubectl failure.

## Throws

When namespace is not in the allowlist.
