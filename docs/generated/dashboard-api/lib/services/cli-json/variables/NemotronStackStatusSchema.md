[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / NemotronStackStatusSchema

# Variable: NemotronStackStatusSchema

> `const` **NemotronStackStatusSchema**: `ZodObject`\<\{ `namespace`: `ZodString`; `stacks`: `ZodArray`\<`ZodObject`\<\{ `components`: `ZodArray`\<`ZodObject`\<\{ `model`: `ZodString`; `state`: `ZodString`; \}, `$strip`\>\>; `healthy`: `ZodBoolean`; `id`: `ZodString`; `label`: `ZodString`; \}, `$strip`\>\>; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:303](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L303)

The Nemotron stack status payload.
