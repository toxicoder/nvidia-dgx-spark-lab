[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cluster-resources](../README.md) / getClusterCapacity

# Function: getClusterCapacity()

> **getClusterCapacity**(): `Promise`\<[`ClusterCapacity`](../../../types/interfaces/ClusterCapacity.md)\>

Defined in: lib/services/cluster-resources.ts:38

Fetch cluster GPU, CPU, and memory capacity snapshot.

## Returns

`Promise`\<[`ClusterCapacity`](../../../types/interfaces/ClusterCapacity.md)\>

Node count and utilization from `cluster-resources.sh status`.
