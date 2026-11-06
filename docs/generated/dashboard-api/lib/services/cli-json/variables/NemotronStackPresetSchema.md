[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / NemotronStackPresetSchema

# Variable: NemotronStackPresetSchema

> `const` **NemotronStackPresetSchema**: `ZodObject`\<\{ `description`: `ZodOptional`\<`ZodString`\>; `heavy`: `ZodOptional`\<`ZodBoolean`\>; `label`: `ZodString`; `max_nodes`: `ZodOptional`\<`ZodNumber`\>; `min_nodes`: `ZodOptional`\<`ZodNumber`\>; `pillars`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `quality_notes`: `ZodOptional`\<`ZodString`\>; `stack_with`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `startup_order`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `tier`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:246](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L246)

One stack preset of the Nemotron catalog.
