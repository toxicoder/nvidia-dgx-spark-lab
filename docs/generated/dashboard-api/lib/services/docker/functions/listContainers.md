[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/docker](../README.md) / listContainers

# Function: listContainers()

> **listContainers**(): `Promise`\<[`DockerListResult`](../../../types/type-aliases/DockerListResult.md)\>

Defined in: [lib/services/docker.ts:52](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/docker.ts#L52)

List running containers (or error shape).
Uses docker CLI JSON lines. Returns DockerListResult union for easy UI branching.

## Returns

`Promise`\<[`DockerListResult`](../../../types/type-aliases/DockerListResult.md)\>
