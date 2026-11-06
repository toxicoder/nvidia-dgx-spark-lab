[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / OpenWebUIBackend

# Interface: OpenWebUIBackend

Defined in: [lib/types/index.ts:475](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L475)

One backend entry of `config/open-webui-policy.json` `backends`.

## Properties

### namespace

> **namespace**: `"dev"` \| `"ai-inference"` \| `"monitoring"` \| `"kube-system"` \| `"gpu-operator"`

Defined in: [lib/types/index.ts:479](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L479)

Namespace the service lives in.

***

### path

> **path**: `string`

Defined in: [lib/types/index.ts:483](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L483)

Base path the UI proxies under.

***

### port

> **port**: `number`

Defined in: [lib/types/index.ts:481](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L481)

Service port.

***

### requires\_hermes\_stack?

> `optional` **requires\_hermes\_stack?**: `string`

Defined in: [lib/types/index.ts:485](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L485)

Stack that must be running before this backend is usable.

***

### service

> **service**: `string`

Defined in: [lib/types/index.ts:477](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L477)

Kubernetes service name providing the backend.
