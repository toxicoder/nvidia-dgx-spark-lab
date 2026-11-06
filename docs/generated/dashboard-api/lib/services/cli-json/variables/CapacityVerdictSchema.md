[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / CapacityVerdictSchema

# Variable: CapacityVerdictSchema

> `const` **CapacityVerdictSchema**: `ZodEnum`\<\{ `error`: `"error"`; `insufficient_cpu`: `"insufficient_cpu"`; `insufficient_cpu_memory`: `"insufficient_cpu_memory"`; `insufficient_gpu`: `"insufficient_gpu"`; `insufficient_gpu_cpu`: `"insufficient_gpu_cpu"`; `insufficient_gpu_cpu_memory`: `"insufficient_gpu_cpu_memory"`; `insufficient_gpu_memory`: `"insufficient_gpu_memory"`; `insufficient_memory`: `"insufficient_memory"`; `insufficient_nodes`: `"insufficient_nodes"`; `ok`: `"ok"`; `too_many_nodes`: `"too_many_nodes"`; `unknown_model`: `"unknown_model"`; `unknown_stack`: `"unknown_stack"`; \}\>

Defined in: [lib/services/cli-json.ts:77](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L77)

The verdict a Resource Guard check can report. Derived, never re-listed.
