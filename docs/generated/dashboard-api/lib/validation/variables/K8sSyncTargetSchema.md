[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / K8sSyncTargetSchema

# Variable: K8sSyncTargetSchema

> `const` **K8sSyncTargetSchema**: `ZodObject`\<\{ `key`: `ZodString`; `namespace`: `ZodEnum`\<\{ `ai-inference`: `"ai-inference"`; `dev`: `"dev"`; \}\>; `secretName`: `ZodString`; \}, `$strip`\>

Defined in: [lib/validation.ts:66](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/validation.ts#L66)

K8s Secret sync target (namespace, secret name, key).
