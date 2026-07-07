[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / DeleteSecretSchema

# Variable: DeleteSecretSchema

> `const` **DeleteSecretSchema**: `ZodObject`\<\{ `confirm`: `ZodLiteral`\<`"DELETE"`\>; `id`: `ZodString`; \}, `"strip"`, `ZodTypeAny`, \{ `confirm`: `"DELETE"`; `id`: `string`; \}, \{ `confirm`: `"DELETE"`; `id`: `string`; \}\>

Defined in: lib/validation.ts:116

Payload for deleting a secret (requires `confirm: "DELETE"`).
