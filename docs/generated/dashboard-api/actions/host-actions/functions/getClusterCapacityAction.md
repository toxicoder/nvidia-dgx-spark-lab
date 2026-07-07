[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / getClusterCapacityAction

# Function: getClusterCapacityAction()

> **getClusterCapacityAction**(): `Promise`\<[`ClusterCapacity`](../../../lib/types/interfaces/ClusterCapacity.md)\>

Defined in: actions/host-actions.ts:207

Fetch cluster GPU, CPU, and memory capacity snapshot.

## Returns

`Promise`\<[`ClusterCapacity`](../../../lib/types/interfaces/ClusterCapacity.md)\>

ClusterCapacity from `cluster-resources.sh`.

## Throws

When session is missing.
