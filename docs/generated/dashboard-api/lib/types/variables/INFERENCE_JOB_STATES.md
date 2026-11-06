[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / INFERENCE\_JOB\_STATES

# Variable: INFERENCE\_JOB\_STATES

> `const` **INFERENCE\_JOB\_STATES**: readonly \[`"absent"`, `"running"`, `"succeeded"`, `"failed"`, `"error"`\]

Defined in: [lib/types/index.ts:412](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L412)

Every lifecycle state an inference Job can report.

Source of truth for [InferenceJobState](../type-aliases/InferenceJobState.md) and for `InferenceJobStateSchema`
in `lib/services/cli-json.ts`, so the schema and the type cannot drift apart.
