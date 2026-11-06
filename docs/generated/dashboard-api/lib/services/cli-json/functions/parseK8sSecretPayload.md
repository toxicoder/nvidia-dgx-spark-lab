[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / parseK8sSecretPayload

# Function: parseK8sSecretPayload()

> **parseK8sSecretPayload**(`stdout`, `utility`): [`K8sSecretPayload`](../../../types/interfaces/K8sSecretPayload.md)

Defined in: [lib/services/cli-json.ts:579](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L579)

Parse the `kubectl get secret -o json` document the key-removal flow reads.

## Parameters

### stdout

`string`

Raw stdout from `kubectl get secret -o json`.

### utility

`string`

Command name for diagnostics.

## Returns

[`K8sSecretPayload`](../../../types/interfaces/K8sSecretPayload.md)

The validated payload; `data` is absent for a Secret with no keys.

## Throws

CliPayloadError When the document is unusable. A `data` map holding a
  non-string value is rejected rather than coerced, because the value is passed
  straight back to `kubectl` when the Secret is rewritten.
