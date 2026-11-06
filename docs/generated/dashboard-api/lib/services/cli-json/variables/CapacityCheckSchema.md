[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / CapacityCheckSchema

# Variable: CapacityCheckSchema

> `const` **CapacityCheckSchema**: `ZodObject`\<\{ `action`: `ZodString`; `available`: `ZodDefault`\<`ZodObject`\<\{ `cpu`: `ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>; `gpus`: `ZodNumber`; `memory`: `ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>; \}, `$strip`\>\>; `deficit`: `ZodDefault`\<`ZodObject`\<\{ `cpu`: `ZodOptional`\<`ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>\>; `gpus`: `ZodOptional`\<`ZodNumber`\>; `memory`: `ZodOptional`\<`ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>\>; \}, `$strip`\>\>; `heavy`: `ZodOptional`\<`ZodBoolean`\>; `ok`: `ZodBoolean`; `required`: `ZodDefault`\<`ZodObject`\<\{ `cpu`: `ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>; `gpus`: `ZodNumber`; `memory`: `ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>; \}, `$strip`\>\>; `verdict`: `ZodEnum`\<\{ `error`: `"error"`; `insufficient_cpu`: `"insufficient_cpu"`; `insufficient_cpu_memory`: `"insufficient_cpu_memory"`; `insufficient_gpu`: `"insufficient_gpu"`; `insufficient_gpu_cpu`: `"insufficient_gpu_cpu"`; `insufficient_gpu_cpu_memory`: `"insufficient_gpu_cpu_memory"`; `insufficient_gpu_memory`: `"insufficient_gpu_memory"`; `insufficient_memory`: `"insufficient_memory"`; `insufficient_nodes`: `"insufficient_nodes"`; `ok`: `"ok"`; `too_many_nodes`: `"too_many_nodes"`; `unknown_model`: `"unknown_model"`; `unknown_stack`: `"unknown_stack"`; \}\>; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:91](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L91)

A Resource Guard verdict as printed by `cluster-resources.sh check --json`.

`required`/`available` default to a zero triple because the utility omits them
when it rejects before totalling resources (`unknown_model`, `unknown_stack`,
`insufficient_nodes`, `too_many_nodes`). Filling them at the boundary is what
lets a renderer read `.gpus` unguarded; the verdict string itself is never
rewritten, so the UI still explains the real reason it refused.
