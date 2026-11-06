[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / NemotronStackComponentStatusSchema

# Variable: NemotronStackComponentStatusSchema

> `const` **NemotronStackComponentStatusSchema**: `ZodObject`\<\{ `model`: `ZodString`; `state`: `ZodString`; \}, `$strip`\>

Defined in: [lib/services/cli-json.ts:289](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L289)

One component of a running Nemotron stack.

`state` stays an open `string`: it carries the Kubernetes Deployment condition
the utility read through verbatim, which has more values than the dashboard
branches on, and collapsing it to an enum would throw away the reason a stack is
unhealthy. The closed sets in this file are all values the *utility* computes.
