[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / ClusterCapacity

# Interface: ClusterCapacity

Defined in: [lib/types/index.ts:108](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L108)

## Properties

### allocatable

> **allocatable**: [`ResourceAmount`](ResourceAmount.md)

Defined in: [lib/types/index.ts:110](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L110)

***

### available

> **available**: [`ResourceAmount`](ResourceAmount.md)

Defined in: [lib/types/index.ts:114](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L114)

***

### error?

> `optional` **error?**: `string`

Defined in: [lib/types/index.ts:116](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L116)

***

### free

> **free**: [`ResourceAmount`](ResourceAmount.md)

Defined in: [lib/types/index.ts:113](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L113)

***

### headroom

> **headroom**: `object`

Defined in: [lib/types/index.ts:112](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L112)

#### cpu

> **cpu**: `number`

#### memory

> **memory**: `number`

***

### node\_count

> **node\_count**: `number`

Defined in: [lib/types/index.ts:109](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L109)

***

### requested

> **requested**: [`ResourceAmount`](ResourceAmount.md)

Defined in: [lib/types/index.ts:111](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L111)

***

### utilization

> **utilization**: `object`

Defined in: [lib/types/index.ts:115](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/types/index.ts#L115)

#### cpu\_pct

> **cpu\_pct**: `number`

#### gpu\_pct

> **gpu\_pct**: `number`

#### memory\_pct

> **memory\_pct**: `number`
