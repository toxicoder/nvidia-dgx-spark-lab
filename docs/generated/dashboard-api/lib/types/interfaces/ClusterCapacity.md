[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / ClusterCapacity

# Interface: ClusterCapacity

Defined in: [lib/types/index.ts:261](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L261)

## Properties

### allocatable

> **allocatable**: [`ResourceAmount`](ResourceAmount.md)

Defined in: [lib/types/index.ts:263](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L263)

***

### available

> **available**: [`ResourceAmount`](ResourceAmount.md)

Defined in: [lib/types/index.ts:267](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L267)

***

### error?

> `optional` **error?**: `string`

Defined in: [lib/types/index.ts:277](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L277)

Set when the capacity utility could not be reached or returned something the
boundary schema rejected; the panel shows mock numbers plus this reason.

`| undefined` is explicit so the zod-derived boundary parsers in
`lib/services/cli-json.ts` can assign an absent optional under
`exactOptionalPropertyTypes`.

***

### free

> **free**: [`ResourceAmount`](ResourceAmount.md)

Defined in: [lib/types/index.ts:266](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L266)

***

### headroom

> **headroom**: `object`

Defined in: [lib/types/index.ts:265](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L265)

#### cpu

> **cpu**: `number`

#### memory

> **memory**: `number`

***

### node\_count

> **node\_count**: `number`

Defined in: [lib/types/index.ts:262](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L262)

***

### requested

> **requested**: [`ResourceAmount`](ResourceAmount.md)

Defined in: [lib/types/index.ts:264](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L264)

***

### utilization

> **utilization**: `object`

Defined in: [lib/types/index.ts:268](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L268)

#### cpu\_pct

> **cpu\_pct**: `number`

#### gpu\_pct

> **gpu\_pct**: `number`

#### memory\_pct

> **memory\_pct**: `number`
