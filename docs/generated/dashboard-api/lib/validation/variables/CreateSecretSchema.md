[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / CreateSecretSchema

# Variable: CreateSecretSchema

> `const` **CreateSecretSchema**: `ZodObject`\<\{ `category`: `ZodEnum`\<\[`"api_key"`, `"token"`, `"password"`, `"other"`\]\>; `description`: `ZodOptional`\<`ZodString`\>; `k8sSync`: `ZodOptional`\<`ZodObject`\<\{ `key`: `ZodString`; `namespace`: `ZodEnum`\<\[`"dev"`, `"ai-inference"`\]\>; `secretName`: `ZodString`; \}, `"strip"`, `ZodTypeAny`, \{ `key`: `string`; `namespace`: `"dev"` \| `"ai-inference"`; `secretName`: `string`; \}, \{ `key`: `string`; `namespace`: `"dev"` \| `"ai-inference"`; `secretName`: `string`; \}\>\>; `name`: `ZodString`; `value`: `ZodString`; \}, `"strip"`, `ZodTypeAny`, \{ `category`: `"token"` \| `"password"` \| `"api_key"` \| `"other"`; `description?`: `string`; `k8sSync?`: \{ `key`: `string`; `namespace`: `"dev"` \| `"ai-inference"`; `secretName`: `string`; \}; `name`: `string`; `value`: `string`; \}, \{ `category`: `"token"` \| `"password"` \| `"api_key"` \| `"other"`; `description?`: `string`; `k8sSync?`: \{ `key`: `string`; `namespace`: `"dev"` \| `"ai-inference"`; `secretName`: `string`; \}; `name`: `string`; `value`: `string`; \}\>

Defined in: lib/validation.ts:94

Payload for creating a new lab secret.
