[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / UpdateSecretMetaSchema

# Variable: UpdateSecretMetaSchema

> `const` **UpdateSecretMetaSchema**: `ZodObject`\<\{ `description`: `ZodOptional`\<`ZodNullable`\<`ZodString`\>\>; `id`: `ZodString`; `k8sSync`: `ZodOptional`\<`ZodNullable`\<`ZodObject`\<\{ `key`: `ZodString`; `namespace`: `ZodEnum`\<\[`"dev"`, `"ai-inference"`\]\>; `secretName`: `ZodString`; \}, `"strip"`, `ZodTypeAny`, \{ `key`: `string`; `namespace`: `"dev"` \| `"ai-inference"`; `secretName`: `string`; \}, \{ `key`: `string`; `namespace`: `"dev"` \| `"ai-inference"`; `secretName`: `string`; \}\>\>\>; \}, `"strip"`, `ZodTypeAny`, \{ `description?`: `string` \| `null`; `id`: `string`; `k8sSync?`: \{ `key`: `string`; `namespace`: `"dev"` \| `"ai-inference"`; `secretName`: `string`; \} \| `null`; \}, \{ `description?`: `string` \| `null`; `id`: `string`; `k8sSync?`: \{ `key`: `string`; `namespace`: `"dev"` \| `"ai-inference"`; `secretName`: `string`; \} \| `null`; \}\>

Defined in: lib/validation.ts:109

Payload for updating secret metadata (description, K8s sync).
