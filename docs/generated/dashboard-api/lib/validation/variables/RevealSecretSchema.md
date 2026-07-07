[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / RevealSecretSchema

# Variable: RevealSecretSchema

> `const` **RevealSecretSchema**: `ZodObject`\<\{ `confirm`: `ZodLiteral`\<`"REVEAL"`\>; `id`: `ZodString`; \}, `"strip"`, `ZodTypeAny`, \{ `confirm`: `"REVEAL"`; `id`: `string`; \}, \{ `confirm`: `"REVEAL"`; `id`: `string`; \}\>

Defined in: lib/validation.ts:122

Payload for revealing a secret (requires `confirm: "REVEAL"`).
