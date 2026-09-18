[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/secrets-actions](../README.md) / createSecretAction

# Function: createSecretAction()

> **createSecretAction**(`input`): `Promise`\<\{ `meta`: [`LabSecretMeta`](../../../lib/types/interfaces/LabSecretMeta.md); `syncError?`: `string`; \}\>

Defined in: [actions/secrets-actions.ts:58](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/secrets-actions.ts#L58)

Create a new encrypted secret with optional K8s sync.

## Parameters

### input

`unknown`

Payload validated by [CreateSecretSchema](../../../lib/validation/variables/CreateSecretSchema.md).

## Returns

`Promise`\<\{ `meta`: [`LabSecretMeta`](../../../lib/types/interfaces/LabSecretMeta.md); `syncError?`: `string`; \}\>

Created metadata and optional sync error message.

## Throws

When session is missing or input fails validation.
