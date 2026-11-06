[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseClusterCapacity

# Function: parseClusterCapacity()

> **parseClusterCapacity**(`stdout`, `utility`): [`ClusterCapacity`](../../../types/interfaces/ClusterCapacity.md)

Defined in: [lib/services/cli-json.ts:434](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L434)

Parse a cluster capacity snapshot.

## Parameters

### stdout

`string`

Raw stdout from `cluster-resources.sh status --json`.

### utility

`string`

Utility name for diagnostics.

## Returns

[`ClusterCapacity`](../../../types/interfaces/ClusterCapacity.md)

The validated snapshot.

## Throws

CliPayloadError When the payload is unusable.
