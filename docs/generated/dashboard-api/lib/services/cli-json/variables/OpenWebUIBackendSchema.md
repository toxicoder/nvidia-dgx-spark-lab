[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / OpenWebUIBackendSchema

# Variable: OpenWebUIBackendSchema

> `const` **OpenWebUIBackendSchema**: `ZodObject`\<\{ `namespace`: `ZodEnum`\<\{ `ai-inference`: `"ai-inference"`; `dev`: `"dev"`; `gpu-operator`: `"gpu-operator"`; `kube-system`: `"kube-system"`; `monitoring`: `"monitoring"`; \}\>; `path`: `ZodString`; `port`: `ZodNumber`; `requires_hermes_stack`: `ZodOptional`\<`ZodString`\>; `service`: `ZodString`; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:336](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L336)

One backend of `config/open-webui-policy.json` as read through the utility.

`namespace` is enum-validated against the namespaces the dashboard is allowed to
name, so a policy file that points at an unlisted namespace is rejected here with
the utility named, rather than reaching `kubectl` through a string. `port` is
plain `number` because `PortNumber` is a documentation alias over it.
