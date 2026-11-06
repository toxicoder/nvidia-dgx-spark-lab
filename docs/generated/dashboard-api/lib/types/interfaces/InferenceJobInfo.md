[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / InferenceJobInfo

# Interface: InferenceJobInfo

Defined in: [lib/types/index.ts:417](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L417)

## Properties

### active?

> `optional` **active?**: `number`

Defined in: [lib/types/index.ts:422](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L422)

`| undefined` so the boundary parser can omit a counter the utility left out.

***

### error?

> `optional` **error?**: `string`

Defined in: [lib/types/index.ts:427](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L427)

***

### failed?

> `optional` **failed?**: `number`

Defined in: [lib/types/index.ts:424](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L424)

***

### job

> **job**: `string`

Defined in: [lib/types/index.ts:420](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L420)

***

### model

> **model**: `string`

Defined in: [lib/types/index.ts:419](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L419)

Model id as reported by the cluster; narrow with [isInferenceModelName](../functions/isInferenceModelName.md).

***

### state

> **state**: `"error"` \| `"running"` \| `"absent"` \| `"succeeded"` \| `"failed"`

Defined in: [lib/types/index.ts:426](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L426)

Closed set; the utility only ever emits one of [INFERENCE\_JOB\_STATES](../variables/INFERENCE_JOB_STATES.md).

***

### succeeded?

> `optional` **succeeded?**: `number`

Defined in: [lib/types/index.ts:423](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L423)
