[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/utilities](../README.md) / listUtilities

# Function: listUtilities()

> **listUtilities**(): [`UtilityInfo`](../../../types/interfaces/UtilityInfo.md)[]

Defined in: [lib/services/utilities.ts:44](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/utilities.ts#L44)

Discover allowlisted utility scripts in `scripts/utilities/`.

## Returns

[`UtilityInfo`](../../../types/interfaces/UtilityInfo.md)[]

Array of `{ name, path }` for each `.sh` file in the allowlist.
