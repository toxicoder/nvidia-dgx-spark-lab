[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/host](../README.md) / withMock

# Function: withMock()

> **withMock**\<`T`\>(`mock`, `real`): `T` \| `Promise`\<`T`\>

Defined in: [lib/host.ts:31](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/host.ts#L31)

Run real command or return mock data when `USE_MOCKS=1`.
Centralizes the common pattern used across services for hermetic tests.

## Type Parameters

### T

`T`

## Parameters

### mock

`T`

Value returned under mock mode.

### real

() => `T` \| `Promise`\<`T`\>

Async or sync function for real execution.

## Returns

`T` \| `Promise`\<`T`\>

Mock value or the result of `real()`.
