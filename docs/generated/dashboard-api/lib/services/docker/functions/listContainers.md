[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/docker](../README.md) / listContainers

# Function: listContainers()

> **listContainers**(): `Promise`\<[`DockerListResult`](../../../types/type-aliases/DockerListResult.md)\>

Defined in: [lib/services/docker.ts:48](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/services/docker.ts#L48)

List running containers (or error shape).
Uses docker CLI JSON lines. Returns DockerListResult union for easy UI branching.

## Returns

`Promise`\<[`DockerListResult`](../../../types/type-aliases/DockerListResult.md)\>
