[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / ClusterCapacity

# Interface: ClusterCapacity

Defined in: lib/types/index.ts:108

## Properties

### allocatable

> **allocatable**: [`ResourceAmount`](ResourceAmount.md)

Defined in: lib/types/index.ts:110

***

### available

> **available**: [`ResourceAmount`](ResourceAmount.md)

Defined in: lib/types/index.ts:114

***

### error?

> `optional` **error?**: `string`

Defined in: lib/types/index.ts:116

***

### free

> **free**: [`ResourceAmount`](ResourceAmount.md)

Defined in: lib/types/index.ts:113

***

### headroom

> **headroom**: `object`

Defined in: lib/types/index.ts:112

#### cpu

> **cpu**: `number`

#### memory

> **memory**: `number`

***

### node\_count

> **node\_count**: `number`

Defined in: lib/types/index.ts:109

***

### requested

> **requested**: [`ResourceAmount`](ResourceAmount.md)

Defined in: lib/types/index.ts:111

***

### utilization

> **utilization**: `object`

Defined in: lib/types/index.ts:115

#### cpu\_pct

> **cpu\_pct**: `number`

#### gpu\_pct

> **gpu\_pct**: `number`

#### memory\_pct

> **memory\_pct**: `number`
