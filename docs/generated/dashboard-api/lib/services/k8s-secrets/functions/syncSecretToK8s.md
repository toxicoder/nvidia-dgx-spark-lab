[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/k8s-secrets](../README.md) / syncSecretToK8s

# Function: syncSecretToK8s()

> **syncSecretToK8s**(`target`, `plaintext`): `Promise`\<[`K8sSecretSyncResult`](../interfaces/K8sSecretSyncResult.md)\>

Defined in: [lib/services/k8s-secrets.ts:53](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/k8s-secrets.ts#L53)

Upsert a Kubernetes Secret key from plaintext (value never logged).

## Parameters

### target

[`K8sSyncTarget`](../../../types/interfaces/K8sSyncTarget.md)

Namespace, secret name, and key (allowlisted namespaces only).

### plaintext

`string`

Secret value written to a temp file for `kubectl create`.

## Returns

`Promise`\<[`K8sSecretSyncResult`](../interfaces/K8sSecretSyncResult.md)\>

`{ ok: true }` or `{ ok: false, error }` on kubectl failure.

## Throws

When namespace is not in the allowlist.
