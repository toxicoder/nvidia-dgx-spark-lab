[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / UtilityStatusSchema

# Variable: UtilityStatusSchema

> `const` **UtilityStatusSchema**: `ZodObject`\<\{ `error`: `ZodOptional`\<`ZodString`\>; `lastRun`: `ZodOptional`\<`ZodString`\>; `name`: `ZodOptional`\<`ZodString`\>; `status`: `ZodOptional`\<`ZodString`\>; \}, `$catchall`\<`ZodUnknown`\>\>

Defined in: [lib/services/cli-json.ts:225](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L225)

A utility's `status --json` payload.

The four keys every utility's `status` contract promises are validated; the
rest of the document is utility-specific (see each script's `# @command`
header) and passes through untouched, which is what the index signature on
`UtilityStatus` already records. `z.unknown()` is the honest type for "whatever
this particular utility prints", and nothing renders those keys generically.
