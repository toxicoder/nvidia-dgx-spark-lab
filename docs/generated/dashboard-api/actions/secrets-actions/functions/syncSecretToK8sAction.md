[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/secrets-actions](../README.md) / syncSecretToK8sAction

# Function: syncSecretToK8sAction()

> **syncSecretToK8sAction**(`input`): `Promise`\<\{ `error?`: `string`; `ok`: `boolean`; \}\>

Defined in: actions/secrets-actions.ts:160

Manually sync a secret's current value to its configured K8s target.

## Parameters

### input

`unknown`

Payload validated by [SyncSecretSchema](../../../lib/validation/variables/SyncSecretSchema.md).

## Returns

`Promise`\<\{ `error?`: `string`; `ok`: `boolean`; \}\>

`{ ok: true }` on success or `{ ok: false, error }` on kubectl failure.

## Throws

When session is missing, secret not found, or no K8s sync target configured.
