[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/secrets-actions](../README.md) / deleteSecretAction

# Function: deleteSecretAction()

> **deleteSecretAction**(`input`): `Promise`\<`void`\>

Defined in: actions/secrets-actions.ts:124

Delete a secret after explicit confirmation.

## Parameters

### input

`unknown`

Payload validated by [DeleteSecretSchema](../../../lib/validation/variables/DeleteSecretSchema.md) (`confirm: "DELETE"`).

## Returns

`Promise`\<`void`\>

Resolves when the secret (and optional K8s key) is removed.

## Throws

When session is missing, secret not found, or input fails validation.
