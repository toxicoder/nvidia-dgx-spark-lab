[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / OpenWebUICatalogSchema

# Variable: OpenWebUICatalogSchema

> `const` **OpenWebUICatalogSchema**: `ZodObject`\<\{ `backends`: `ZodRecord`\<`ZodString`, `ZodObject`\<\{ `namespace`: `ZodEnum`\<\{ `ai-inference`: `"ai-inference"`; `dev`: `"dev"`; `gpu-operator`: `"gpu-operator"`; `kube-system`: `"kube-system"`; `monitoring`: `"monitoring"`; \}\>; `path`: `ZodString`; `port`: `ZodNumber`; `requires_hermes_stack`: `ZodOptional`\<`ZodString`\>; `service`: `ZodString`; \}, `$strip`\>\>; `helm`: `ZodRecord`\<`ZodString`, `ZodString`\>; `ports`: `ZodRecord`\<`ZodString`, `ZodNumber`\>; `sso`: `ZodRecord`\<`ZodString`, `ZodString`\>; `stacks`: `ZodRecord`\<`ZodString`, `ZodObject`\<\{ `description`: `ZodOptional`\<`ZodString`\>; `label`: `ZodString`; `requires_hermes_stack`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:345](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L345)

The Open WebUI catalog payload.
