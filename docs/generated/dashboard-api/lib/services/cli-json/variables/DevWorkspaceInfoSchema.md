[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / DevWorkspaceInfoSchema

# Variable: DevWorkspaceInfoSchema

> `const` **DevWorkspaceInfoSchema**: `ZodObject`\<\{ `helmInstalled`: `ZodBoolean`; `name`: `ZodEnum`\<\{ `coder`: `"coder"`; `kasm`: `"kasm"`; \}\>; `readyPods`: `ZodNumber`; `state`: `ZodEnum`\<\{ `error`: `"error"`; `running`: `"running"`; `starting`: `"starting"`; `stopped`: `"stopped"`; `stopping`: `"stopping"`; \}\>; `totalPods`: `ZodNumber`; `url`: `ZodString`; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:156](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L156)

One dev workspace as printed by `dev-workspaces.sh status --json`.
