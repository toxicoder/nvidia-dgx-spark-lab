[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / DevWorkspacesStatusSchema

# Variable: DevWorkspacesStatusSchema

> `const` **DevWorkspacesStatusSchema**: `ZodObject`\<\{ `coder`: `ZodObject`\<\{ `helmInstalled`: `ZodBoolean`; `name`: `ZodEnum`\<\{ `coder`: `"coder"`; `kasm`: `"kasm"`; \}\>; `readyPods`: `ZodNumber`; `state`: `ZodEnum`\<\{ `error`: `"error"`; `running`: `"running"`; `starting`: `"starting"`; `stopped`: `"stopped"`; `stopping`: `"stopping"`; \}\>; `totalPods`: `ZodNumber`; `url`: `ZodString`; \}, `$strip`\>; `error`: `ZodOptional`\<`ZodString`\>; `kasm`: `ZodObject`\<\{ `helmInstalled`: `ZodBoolean`; `name`: `ZodEnum`\<\{ `coder`: `"coder"`; `kasm`: `"kasm"`; \}\>; `readyPods`: `ZodNumber`; `state`: `ZodEnum`\<\{ `error`: `"error"`; `running`: `"running"`; `starting`: `"starting"`; `stopped`: `"stopped"`; `stopping`: `"stopping"`; \}\>; `totalPods`: `ZodNumber`; `url`: `ZodString`; \}, `$strip`\>; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:169](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L169)

Both workspaces are required: the panel renders a row per workspace, so a half
payload means a broken utility rather than a workspace that is merely absent.
