[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / CapacityDeficit

# Interface: CapacityDeficit

Defined in: [lib/types/index.ts:287](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L287)

How much of each dimension a check came up short by.

Only the short dimensions appear. Spelled out rather than `Partial<ResourceAmount>`
because, under `exactOptionalPropertyTypes`, `Partial` still forbids an explicit
`undefined`, which is exactly what the boundary parser produces for an absent key.

## Properties

### cpu?

> `optional` **cpu?**: `string`

Defined in: [lib/types/index.ts:289](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L289)

***

### gpus?

> `optional` **gpus?**: `number`

Defined in: [lib/types/index.ts:288](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L288)

***

### memory?

> `optional` **memory?**: `string`

Defined in: [lib/types/index.ts:290](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L290)
