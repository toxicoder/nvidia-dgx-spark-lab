[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / UpdateSecretMetaSchema

# Variable: UpdateSecretMetaSchema

> `const` **UpdateSecretMetaSchema**: `ZodObject`\<\{ `description`: `ZodOptional`\<`ZodNullable`\<`ZodString`\>\>; `id`: `ZodString`; `k8sSync`: `ZodOptional`\<`ZodNullable`\<`ZodObject`\<\{ `key`: `ZodString`; `namespace`: `ZodEnum`\<\{ `ai-inference`: `"ai-inference"`; `dev`: `"dev"`; \}\>; `secretName`: `ZodString`; \}, `$strip`\>\>\>; \}, `$strip`\>

Defined in: [lib/validation.ts:88](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/validation.ts#L88)

Payload for updating secret metadata (description, K8s sync).
