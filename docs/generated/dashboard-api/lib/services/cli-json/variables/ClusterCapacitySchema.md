[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / ClusterCapacitySchema

# Variable: ClusterCapacitySchema

> `const` **ClusterCapacitySchema**: `ZodObject`\<\{ `allocatable`: `ZodObject`\<\{ `cpu`: `ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>; `gpus`: `ZodNumber`; `memory`: `ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>; \}, `$strip`\>; `available`: `ZodObject`\<\{ `cpu`: `ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>; `gpus`: `ZodNumber`; `memory`: `ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>; \}, `$strip`\>; `error`: `ZodOptional`\<`ZodString`\>; `free`: `ZodObject`\<\{ `cpu`: `ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>; `gpus`: `ZodNumber`; `memory`: `ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>; \}, `$strip`\>; `headroom`: `ZodObject`\<\{ `cpu`: `ZodNumber`; `memory`: `ZodNumber`; \}, `$strip`\>; `node_count`: `ZodNumber`; `requested`: `ZodObject`\<\{ `cpu`: `ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>; `gpus`: `ZodNumber`; `memory`: `ZodPipe`\<`ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>, `ZodTransform`\<`string`, `string` \| `number`\>\>; \}, `$strip`\>; `utilization`: `ZodObject`\<\{ `cpu_pct`: `ZodNumber`; `gpu_pct`: `ZodNumber`; `memory_pct`: `ZodNumber`; \}, `$strip`\>; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:61](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L61)

A capacity snapshot as printed by `cluster-resources.sh status --json`.

Unknown keys are stripped rather than passed through: everything the dashboard
renders is declared here, so an undeclared key is either dead weight or a
rename the schema should have caught.
