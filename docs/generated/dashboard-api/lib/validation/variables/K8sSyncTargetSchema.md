[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / K8sSyncTargetSchema

# Variable: K8sSyncTargetSchema

> `const` **K8sSyncTargetSchema**: `ZodObject`\<\{ `key`: `ZodString`; `namespace`: `ZodEnum`\<\[`"dev"`, `"ai-inference"`\]\>; `secretName`: `ZodString`; \}, `"strip"`, `ZodTypeAny`, \{ `key`: `string`; `namespace`: `"dev"` \| `"ai-inference"`; `secretName`: `string`; \}, \{ `key`: `string`; `namespace`: `"dev"` \| `"ai-inference"`; `secretName`: `string`; \}\>

Defined in: lib/validation.ts:87

K8s Secret sync target (namespace, secret name, key).
