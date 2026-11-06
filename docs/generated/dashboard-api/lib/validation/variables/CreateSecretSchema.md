[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / CreateSecretSchema

# Variable: CreateSecretSchema

> `const` **CreateSecretSchema**: `ZodObject`\<\{ `category`: `ZodEnum`\<\{ `api_key`: `"api_key"`; `other`: `"other"`; `password`: `"password"`; `token`: `"token"`; \}\>; `description`: `ZodOptional`\<`ZodString`\>; `k8sSync`: `ZodOptional`\<`ZodObject`\<\{ `key`: `ZodString`; `namespace`: `ZodEnum`\<\{ `ai-inference`: `"ai-inference"`; `dev`: `"dev"`; \}\>; `secretName`: `ZodString`; \}, `$strip`\>\>; `name`: `ZodString`; `value`: `ZodString`; \}, `$strip`\>

Defined in: [lib/validation.ts:73](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/validation.ts#L73)

Payload for creating a new lab secret.
