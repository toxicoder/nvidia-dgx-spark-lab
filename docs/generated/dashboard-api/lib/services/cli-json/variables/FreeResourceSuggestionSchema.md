[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / FreeResourceSuggestionSchema

# Variable: FreeResourceSuggestionSchema

> `const` **FreeResourceSuggestionSchema**: `ZodObject`\<\{ `action`: `ZodString`; `applicable`: `ZodBoolean`; `frees`: `ZodRecord`\<`ZodString`, `ZodUnion`\<readonly \[`ZodString`, `ZodNumber`\]\>\>; `id`: `ZodString`; `impact`: `ZodString`; `label`: `ZodString`; `reversible`: `ZodBoolean`; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:108](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L108)

One row of `cluster-resources.sh suggest --json`.
