[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / NemotronCatalogSchema

# Variable: NemotronCatalogSchema

> `const` **NemotronCatalogSchema**: `ZodObject`\<\{ `models`: `ZodRecord`\<`ZodString`, `ZodObject`\<\{ `agent_roles`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `cpu_only`: `ZodOptional`\<`ZodBoolean`\>; `display_name`: `ZodString`; `family`: `ZodString`; `openai_svc`: `ZodOptional`\<`ZodString`\>; `port`: `ZodOptional`\<`ZodNumber`\>; `runtime`: `ZodString`; \}, `$strip`\>\>; `pillars`: `ZodRecord`\<`ZodString`, `ZodObject`\<\{ `icon`: `ZodString`; `label`: `ZodString`; \}, `$strip`\>\>; `qwen_tiers`: `ZodOptional`\<`ZodObject`\<\{ `frontier_target`: `ZodOptional`\<`ZodString`\>; `spark_1`: `ZodOptional`\<`ZodObject`\<\{ `hf_path`: `ZodOptional`\<`ZodString`\>; `model`: `ZodOptional`\<`ZodString`\>; `rationale`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>; `spark_2`: `ZodOptional`\<`ZodObject`\<\{ `hf_path`: `ZodOptional`\<`ZodString`\>; `model`: `ZodOptional`\<`ZodString`\>; `rationale`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>; `spark_4`: `ZodOptional`\<`ZodObject`\<\{ `hf_path`: `ZodOptional`\<`ZodString`\>; `model`: `ZodOptional`\<`ZodString`\>; `rationale`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>; \}, `$strip`\>\>; `stacks`: `ZodRecord`\<`ZodString`, `ZodObject`\<\{ `description`: `ZodOptional`\<`ZodString`\>; `heavy`: `ZodOptional`\<`ZodBoolean`\>; `label`: `ZodString`; `max_nodes`: `ZodOptional`\<`ZodNumber`\>; `min_nodes`: `ZodOptional`\<`ZodNumber`\>; `pillars`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `quality_notes`: `ZodOptional`\<`ZodString`\>; `stack_with`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `startup_order`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `tier`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:267](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L267)

The Nemotron catalog payload: models, pillars, presets, and optional tiers.
