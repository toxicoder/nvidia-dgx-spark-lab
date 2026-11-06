[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / InferenceJobStateSchema

# Variable: InferenceJobStateSchema

> `const` **InferenceJobStateSchema**: `ZodEnum`\<\{ `absent`: `"absent"`; `error`: `"error"`; `failed`: `"failed"`; `running`: `"running"`; `succeeded`: `"succeeded"`; \}\>

Defined in: [lib/services/cli-json.ts:121](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L121)

The lifecycle state an inference Job can report. Derived, never re-listed.
