[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / K8sSecretPayloadSchema

# Variable: K8sSecretPayloadSchema

> `const` **K8sSecretPayloadSchema**: `ZodObject`\<\{ `data`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodString`\>\>; `metadata`: `ZodOptional`\<`ZodObject`\<\{ `name`: `ZodOptional`\<`ZodString`\>; `namespace`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:361](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L361)

The part of a `kubectl get secret -o json` document the key-removal flow reads.
