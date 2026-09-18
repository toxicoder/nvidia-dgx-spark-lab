[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cluster-resources](../README.md) / getClusterCapacity

# Function: getClusterCapacity()

> **getClusterCapacity**(): `Promise`\<[`ClusterCapacity`](../../../types/interfaces/ClusterCapacity.md)\>

Defined in: [lib/services/cluster-resources.ts:38](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/cluster-resources.ts#L38)

Fetch cluster GPU, CPU, and memory capacity snapshot.

## Returns

`Promise`\<[`ClusterCapacity`](../../../types/interfaces/ClusterCapacity.md)\>

Node count and utilization from `cluster-resources.sh status`.
