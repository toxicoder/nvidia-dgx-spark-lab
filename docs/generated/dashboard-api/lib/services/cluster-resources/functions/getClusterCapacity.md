[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cluster-resources](../README.md) / getClusterCapacity

# Function: getClusterCapacity()

> **getClusterCapacity**(): `Promise`\<[`ClusterCapacity`](../../../types/interfaces/ClusterCapacity.md)\>

Defined in: [lib/services/cluster-resources.ts:42](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cluster-resources.ts#L42)

Fetch cluster GPU, CPU, and memory capacity snapshot.

## Returns

`Promise`\<[`ClusterCapacity`](../../../types/interfaces/ClusterCapacity.md)\>

Node count and utilization from `cluster-resources.sh status`.
