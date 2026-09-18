[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/validation](../README.md) / CreateSecretSchema

# Variable: CreateSecretSchema

> `const` **CreateSecretSchema**: `ZodObject`\<\{ `category`: `ZodEnum`\<\{ `api_key`: `"api_key"`; `other`: `"other"`; `password`: `"password"`; `token`: `"token"`; \}\>; `description`: `ZodOptional`\<`ZodString`\>; `k8sSync`: `ZodOptional`\<`ZodObject`\<\{ `key`: `ZodString`; `namespace`: `ZodEnum`\<\{ `ai-inference`: `"ai-inference"`; `dev`: `"dev"`; \}\>; `secretName`: `ZodString`; \}, `$strip`\>\>; `name`: `ZodString`; `value`: `ZodString`; \}, `$strip`\>

Defined in: [lib/validation.ts:108](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/validation.ts#L108)

Payload for creating a new lab secret.
