[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / CapacityCheck

# Interface: CapacityCheck

Defined in: [lib/types/index.ts:293](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L293)

## Properties

### action

> **action**: `string`

Defined in: [lib/types/index.ts:297](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L297)

***

### available

> **available**: [`ResourceAmount`](ResourceAmount.md)

Defined in: [lib/types/index.ts:301](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L301)

***

### deficit

> **deficit**: [`CapacityDeficit`](CapacityDeficit.md)

Defined in: [lib/types/index.ts:302](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L302)

***

### heavy?

> `optional` **heavy?**: `boolean`

Defined in: [lib/types/index.ts:299](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L299)

Present once the stack/model spec resolves. `| undefined` so the boundary parsers can omit it.

***

### ok

> **ok**: `boolean`

Defined in: [lib/types/index.ts:294](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L294)

***

### required

> **required**: [`ResourceAmount`](ResourceAmount.md)

Defined in: [lib/types/index.ts:300](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L300)

***

### verdict

> **verdict**: `"ok"` \| `"error"` \| `"unknown_model"` \| `"unknown_stack"` \| `"insufficient_nodes"` \| `"too_many_nodes"` \| `"insufficient_gpu"` \| `"insufficient_cpu"` \| `"insufficient_memory"` \| `"insufficient_gpu_cpu"` \| `"insufficient_gpu_memory"` \| `"insufficient_cpu_memory"` \| `"insufficient_gpu_cpu_memory"`

Defined in: [lib/types/index.ts:296](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L296)

Closed set; the utility only ever emits one of [CAPACITY\_VERDICTS](../variables/CAPACITY_VERDICTS.md).
