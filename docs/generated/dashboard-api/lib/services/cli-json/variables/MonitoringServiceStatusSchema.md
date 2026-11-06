[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / MonitoringServiceStatusSchema

# Variable: MonitoringServiceStatusSchema

> `const` **MonitoringServiceStatusSchema**: `ZodObject`\<\{ `helmInstalled`: `ZodBoolean`; `name`: `ZodString`; `readyPods`: `ZodNumber`; `state`: `ZodEnum`\<\{ `error`: `"error"`; `running`: `"running"`; `starting`: `"starting"`; `stopped`: `"stopped"`; \}\>; `totalPods`: `ZodNumber`; `urls`: `ZodOptional`\<`ZodObject`\<\{ `local`: `ZodOptional`\<`ZodString`\>; `nodeport`: `ZodString`; `public`: `ZodOptional`\<`ZodNullable`\<`ZodString`\>\>; `sso`: `ZodString`; \}, `$strip`\>\>; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:184](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L184)

One monitoring service as printed by `monitoring-stack.sh status --json`.
