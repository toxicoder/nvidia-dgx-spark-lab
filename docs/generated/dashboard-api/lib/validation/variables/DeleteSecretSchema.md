[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / DeleteSecretSchema

# Variable: DeleteSecretSchema

> `const` **DeleteSecretSchema**: `ZodObject`\<\{ `confirm`: `ZodLiteral`\<`"DELETE"`\>; `id`: `ZodString`; \}, `$strip`\>

Defined in: [lib/validation.ts:95](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/validation.ts#L95)

Payload for deleting a secret (requires `confirm: "DELETE"`).
