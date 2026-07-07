[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/secrets-actions](../README.md) / updateSecretValueAction

# Function: updateSecretValueAction()

> **updateSecretValueAction**(`input`): `Promise`\<\{ `meta`: [`LabSecretMeta`](../../../lib/types/interfaces/LabSecretMeta.md); `syncError?`: `string`; \}\>

Defined in: actions/secrets-actions.ts:82

Update a secret's plaintext value (re-encrypts and optionally re-syncs to K8s).

## Parameters

### input

`unknown`

Payload validated by [UpdateSecretValueSchema](../../../lib/validation/variables/UpdateSecretValueSchema.md).

## Returns

`Promise`\<\{ `meta`: [`LabSecretMeta`](../../../lib/types/interfaces/LabSecretMeta.md); `syncError?`: `string`; \}\>

Updated metadata and optional sync error message.

## Throws

When session is missing or input fails validation.
