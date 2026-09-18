[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / RevealSecretSchema

# Variable: RevealSecretSchema

> `const` **RevealSecretSchema**: `ZodObject`\<\{ `confirm`: `ZodLiteral`\<`"REVEAL"`\>; `id`: `ZodString`; \}, `$strip`\>

Defined in: [lib/validation.ts:136](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/validation.ts#L136)

Payload for revealing a secret (requires `confirm: "REVEAL"`).
