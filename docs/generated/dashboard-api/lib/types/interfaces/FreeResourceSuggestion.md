[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / FreeResourceSuggestion

# Interface: FreeResourceSuggestion

Defined in: [lib/types/index.ts:308](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L308)

## Properties

### action

> **action**: `string`

Defined in: [lib/types/index.ts:311](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L311)

***

### applicable

> **applicable**: `boolean`

Defined in: [lib/types/index.ts:314](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L314)

***

### frees

> **frees**: `Record`\<`string`, [`FreesValue`](../type-aliases/FreesValue.md)\>

Defined in: [lib/types/index.ts:322](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L322)

What stopping this workload would release, keyed by dimension.

Values mix kinds on purpose: `"4Gi"`, `0`, and the sentinel `"all"` all
appear depending on how well the estimator can bound the saving. `gpus_note`
carries `"approx"` for job estimates.

***

### id

> **id**: `string`

Defined in: [lib/types/index.ts:309](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L309)

***

### impact

> **impact**: `string`

Defined in: [lib/types/index.ts:313](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L313)

***

### label

> **label**: `string`

Defined in: [lib/types/index.ts:310](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L310)

***

### reversible

> **reversible**: `boolean`

Defined in: [lib/types/index.ts:312](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L312)
