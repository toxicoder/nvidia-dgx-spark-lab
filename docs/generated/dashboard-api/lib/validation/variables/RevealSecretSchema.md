[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / RevealSecretSchema

# Variable: RevealSecretSchema

> `const` **RevealSecretSchema**: `ZodObject`\<\{ `confirm`: `ZodLiteral`\<`"REVEAL"`\>; `id`: `ZodString`; \}, `$strip`\>

Defined in: [lib/validation.ts:101](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/validation.ts#L101)

Payload for revealing a secret (requires `confirm: "REVEAL"`).
