[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / OpenWebUIStatus

# Interface: OpenWebUIStatus

Defined in: [lib/types/index.ts:267](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L267)

## Properties

### backend

> **backend**: `object`

Defined in: [lib/types/index.ts:279](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L279)

#### hermes\_gateway

> **hermes\_gateway**: [`OpenWebUIBackendStatus`](OpenWebUIBackendStatus.md)

***

### error?

> `optional` **error?**: `string`

Defined in: [lib/types/index.ts:285](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L285)

***

### helm\_installed

> **helm\_installed**: `boolean`

Defined in: [lib/types/index.ts:271](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L271)

***

### namespace

> **namespace**: `string`

Defined in: [lib/types/index.ts:269](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L269)

***

### pod\_ready

> **pod\_ready**: `boolean`

Defined in: [lib/types/index.ts:272](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L272)

***

### prerequisites

> **prerequisites**: `object`

Defined in: [lib/types/index.ts:282](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L282)

#### hermes\_stack

> **hermes\_stack**: `string`

***

### release

> **release**: `string`

Defined in: [lib/types/index.ts:268](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L268)

***

### state

> **state**: [`OpenWebUIState`](../type-aliases/OpenWebUIState.md)

Defined in: [lib/types/index.ts:270](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L270)

***

### urls

> **urls**: `object`

Defined in: [lib/types/index.ts:273](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L273)

#### local?

> `optional` **local?**: `string`

#### nodeport

> **nodeport**: `string`

#### public?

> `optional` **public?**: `string` \| `null`

#### sso

> **sso**: `string`
