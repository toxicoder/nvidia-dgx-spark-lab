[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / NemotronCatalogModelSchema

# Variable: NemotronCatalogModelSchema

> `const` **NemotronCatalogModelSchema**: `ZodObject`\<\{ `agent_roles`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `cpu_only`: `ZodOptional`\<`ZodBoolean`\>; `display_name`: `ZodString`; `family`: `ZodString`; `openai_svc`: `ZodOptional`\<`ZodString`\>; `port`: `ZodOptional`\<`ZodNumber`\>; `runtime`: `ZodString`; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:235](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L235)

One model entry of `nemotron-stack.sh catalog --json`.
