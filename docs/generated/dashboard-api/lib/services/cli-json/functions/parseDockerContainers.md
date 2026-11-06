[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseDockerContainers

# Function: parseDockerContainers()

> **parseDockerContainers**(`stdout`, `utility`): [`DockerListResult`](../../../types/type-aliases/DockerListResult.md)

Defined in: [lib/services/cli-json.ts:473](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L473)

Parse a whole `docker ps --format '{{json .}}'` document.

`listContainers` reports a bad payload as a value (`{ error }`) rather than by
throwing, because its callers branch on the `DockerListResult` union to show a
friendly panel state. That contract is why this one parser returns instead of
raising, and why it distinguishes "not JSON" from "not the shape we render".

## Parameters

### stdout

`string`

Raw stdout from `docker ps`, one JSON object per line.

### utility

`string`

Command name for diagnostics.

## Returns

[`DockerListResult`](../../../types/type-aliases/DockerListResult.md)

The containers, or the reason the first unusable line was rejected.
