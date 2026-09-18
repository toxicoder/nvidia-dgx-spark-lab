[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / K8sSyncTargetSchema

# Variable: K8sSyncTargetSchema

> `const` **K8sSyncTargetSchema**: `ZodObject`\<\{ `key`: `ZodString`; `namespace`: `ZodEnum`\<\{ `ai-inference`: `"ai-inference"`; `dev`: `"dev"`; \}\>; `secretName`: `ZodString`; \}, `$strip`\>

Defined in: [lib/validation.ts:101](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/validation.ts#L101)

K8s Secret sync target (namespace, secret name, key).
