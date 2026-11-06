[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / K8sSecretPayload

# Interface: K8sSecretPayload

Defined in: [lib/types/index.ts:579](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L579)

The part of a Kubernetes Secret object the key-removal flow reads.

`kubectl get secret -o json` returns the whole API object; only `data` drives
the delete-or-rewrite decision, and `metadata` is kept so a wrong secret can be
named in a diagnostic. Everything else is dropped at the boundary.

## Properties

### data?

> `optional` **data?**: `Record`\<`string`, `string`\>

Defined in: [lib/types/index.ts:581](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L581)

***

### metadata?

> `optional` **metadata?**: `object`

Defined in: [lib/types/index.ts:580](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L580)

#### name?

> `optional` **name?**: `string`

#### namespace?

> `optional` **namespace?**: `string`
