[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / DeleteSecretSchema

# Variable: DeleteSecretSchema

> `const` **DeleteSecretSchema**: `ZodObject`\<\{ `confirm`: `ZodLiteral`\<`"DELETE"`\>; `id`: `ZodString`; \}, `$strip`\>

Defined in: [lib/validation.ts:130](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/validation.ts#L130)

Payload for deleting a secret (requires `confirm: "DELETE"`).
