[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/docker](../README.md) / listContainers

# Function: listContainers()

> **listContainers**(): `Promise`\<[`DockerListResult`](../../../types/type-aliases/DockerListResult.md)\>

Defined in: lib/services/docker.ts:48

List running containers (or error shape).
Uses docker CLI JSON lines. Returns DockerListResult union for easy UI branching.

## Returns

`Promise`\<[`DockerListResult`](../../../types/type-aliases/DockerListResult.md)\>
