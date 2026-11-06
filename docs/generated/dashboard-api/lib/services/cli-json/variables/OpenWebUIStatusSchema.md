[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / OpenWebUIStatusSchema

# Variable: OpenWebUIStatusSchema

> `const` **OpenWebUIStatusSchema**: `ZodObject`\<\{ `backend`: `ZodObject`\<\{ `hermes_gateway`: `ZodObject`\<\{ `endpoint_ip`: `ZodOptional`\<`ZodString`\>; `reachable`: `ZodBoolean`; `url`: `ZodString`; \}, `$strip`\>; \}, `$strip`\>; `error`: `ZodOptional`\<`ZodString`\>; `helm_installed`: `ZodBoolean`; `namespace`: `ZodString`; `pod_ready`: `ZodBoolean`; `prerequisites`: `ZodObject`\<\{ `hermes_stack`: `ZodString`; \}, `$strip`\>; `release`: `ZodString`; `state`: `ZodEnum`\<\{ `running`: `"running"`; `starting`: `"starting"`; `stopped`: `"stopped"`; \}\>; `urls`: `ZodObject`\<\{ `local`: `ZodOptional`\<`ZodString`\>; `nodeport`: `ZodString`; `public`: `ZodOptional`\<`ZodNullable`\<`ZodString`\>\>; `sso`: `ZodString`; \}, `$strip`\>; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:316](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L316)

The Open WebUI status payload.
