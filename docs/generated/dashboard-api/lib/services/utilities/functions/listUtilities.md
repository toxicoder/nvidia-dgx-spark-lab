[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/utilities](../README.md) / listUtilities

# Function: listUtilities()

> **listUtilities**(): [`UtilityInfo`](../../../types/interfaces/UtilityInfo.md)[]

Defined in: [lib/services/utilities.ts:45](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/utilities.ts#L45)

Discover allowlisted utility scripts in `scripts/utilities/`.

## Returns

[`UtilityInfo`](../../../types/interfaces/UtilityInfo.md)[]

Array of `{ name, path }` for each `.sh` file in the allowlist.
