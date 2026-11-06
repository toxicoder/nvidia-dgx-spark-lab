[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / InferenceWorkloadsStatusSchema

# Variable: InferenceWorkloadsStatusSchema

> `const` **InferenceWorkloadsStatusSchema**: `ZodObject`\<\{ `error`: `ZodOptional`\<`ZodString`\>; `jobs`: `ZodArray`\<`ZodObject`\<\{ `active`: `ZodOptional`\<`ZodNumber`\>; `error`: `ZodOptional`\<`ZodString`\>; `failed`: `ZodOptional`\<`ZodNumber`\>; `job`: `ZodString`; `model`: `ZodString`; `state`: `ZodEnum`\<\{ `absent`: `"absent"`; `error`: `"error"`; `failed`: `"failed"`; `running`: `"running"`; `succeeded`: `"succeeded"`; \}\>; `succeeded`: `ZodOptional`\<`ZodNumber`\>; \}, `$strip`\>\>; `namespace`: `ZodString`; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:141](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L141)

The full inference/visual workload status payload.
