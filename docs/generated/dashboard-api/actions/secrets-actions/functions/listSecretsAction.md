[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/secrets-actions](../README.md) / listSecretsAction

# Function: listSecretsAction()

> **listSecretsAction**(): `Promise`\<[`LabSecretMeta`](../../../lib/types/interfaces/LabSecretMeta.md)[]\>

Defined in: [actions/secrets-actions.ts:47](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/secrets-actions.ts#L47)

List all lab secrets (metadata only — no plaintext values).

## Returns

`Promise`\<[`LabSecretMeta`](../../../lib/types/interfaces/LabSecretMeta.md)[]\>

Array of [LabSecretMeta](../../../lib/types/interfaces/LabSecretMeta.md) records.

## Throws

When session is missing.
