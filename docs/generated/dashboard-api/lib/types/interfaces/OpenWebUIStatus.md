[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / OpenWebUIStatus

# Interface: OpenWebUIStatus

Defined in: [lib/types/index.ts:453](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L453)

## Properties

### backend

> **backend**: `object`

Defined in: [lib/types/index.ts:465](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L465)

#### hermes\_gateway

> **hermes\_gateway**: [`OpenWebUIBackendStatus`](OpenWebUIBackendStatus.md)

***

### error?

> `optional` **error?**: `string`

Defined in: [lib/types/index.ts:471](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L471)

***

### helm\_installed

> **helm\_installed**: `boolean`

Defined in: [lib/types/index.ts:457](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L457)

***

### namespace

> **namespace**: `string`

Defined in: [lib/types/index.ts:455](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L455)

***

### pod\_ready

> **pod\_ready**: `boolean`

Defined in: [lib/types/index.ts:458](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L458)

***

### prerequisites

> **prerequisites**: `object`

Defined in: [lib/types/index.ts:468](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L468)

#### hermes\_stack

> **hermes\_stack**: `string`

***

### release

> **release**: `string`

Defined in: [lib/types/index.ts:454](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L454)

***

### state

> **state**: `"stopped"` \| `"starting"` \| `"running"`

Defined in: [lib/types/index.ts:456](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L456)

***

### urls

> **urls**: `object`

Defined in: [lib/types/index.ts:459](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L459)

#### local?

> `optional` **local?**: `string`

#### nodeport

> **nodeport**: `string`

#### public?

> `optional` **public?**: `string` \| `null`

#### sso

> **sso**: `string`
