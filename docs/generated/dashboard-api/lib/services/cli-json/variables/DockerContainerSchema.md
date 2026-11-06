[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / DockerContainerSchema

# Variable: DockerContainerSchema

> `const` **DockerContainerSchema**: `ZodObject`\<\{ `ID`: `ZodString`; `Image`: `ZodString`; `Names`: `ZodString`; `Status`: `ZodString`; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:148](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L148)

One line of `docker ps --format '{{json .}}'`.
