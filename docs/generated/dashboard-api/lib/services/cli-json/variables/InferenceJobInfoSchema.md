[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / InferenceJobInfoSchema

# Variable: InferenceJobInfoSchema

> `const` **InferenceJobInfoSchema**: `ZodObject`\<\{ `active`: `ZodOptional`\<`ZodNumber`\>; `error`: `ZodOptional`\<`ZodString`\>; `failed`: `ZodOptional`\<`ZodNumber`\>; `job`: `ZodString`; `model`: `ZodString`; `state`: `ZodEnum`\<\{ `absent`: `"absent"`; `error`: `"error"`; `failed`: `"failed"`; `running`: `"running"`; `succeeded`: `"succeeded"`; \}\>; `succeeded`: `ZodOptional`\<`ZodNumber`\>; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:130](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L130)

One row of `inference-workloads.sh status --json`.

`model` stays an open `string`: a Job can outlive a catalog edit, and rejecting
the whole payload over one unrecognised name would blank the panel the operator
needs most in that situation. Callers narrow with `isInferenceModelName`.
