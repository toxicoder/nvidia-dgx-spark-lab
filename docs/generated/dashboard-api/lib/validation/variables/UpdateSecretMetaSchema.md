[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / UpdateSecretMetaSchema

# Variable: UpdateSecretMetaSchema

> `const` **UpdateSecretMetaSchema**: `ZodObject`\<\{ `description`: `ZodOptional`\<`ZodNullable`\<`ZodString`\>\>; `id`: `ZodString`; `k8sSync`: `ZodOptional`\<`ZodNullable`\<`ZodObject`\<\{ `key`: `ZodString`; `namespace`: `ZodEnum`\<\{ `ai-inference`: `"ai-inference"`; `dev`: `"dev"`; \}\>; `secretName`: `ZodString`; \}, `$strip`\>\>\>; \}, `$strip`\>

Defined in: [lib/validation.ts:123](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/validation.ts#L123)

Payload for updating secret metadata (description, K8s sync).
