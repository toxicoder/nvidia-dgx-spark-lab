[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / CAPACITY\_VERDICTS

# Variable: CAPACITY\_VERDICTS

> `const` **CAPACITY\_VERDICTS**: readonly \[`"ok"`, `"error"`, `"unknown_model"`, `"unknown_stack"`, `"insufficient_nodes"`, `"too_many_nodes"`, `"insufficient_gpu"`, `"insufficient_cpu"`, `"insufficient_memory"`, `"insufficient_gpu_cpu"`, `"insufficient_gpu_memory"`, `"insufficient_cpu_memory"`, `"insufficient_gpu_cpu_memory"`\]

Defined in: [lib/types/index.ts:112](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L112)

Every verdict a Resource Guard check can report.

Source of truth for [CapacityVerdict](../type-aliases/CapacityVerdict.md) and for `CapacityVerdictSchema`.
Mirrors `CapacityVerdict` (a `StrEnum`) in `scripts/lib/py/lab_types.py`; the
composed members stack in GPU, CPU, memory order.

`"error"` has no Python counterpart: `lib/services/cluster-resources.ts`
synthesises it when the capacity utility itself cannot run, so the panel can
distinguish "the cluster cannot fit this" from "we could not ask the cluster".
