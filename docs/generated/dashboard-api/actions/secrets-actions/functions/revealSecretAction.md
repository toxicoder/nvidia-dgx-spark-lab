[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/secrets-actions](../README.md) / revealSecretAction

# Function: revealSecretAction()

> **revealSecretAction**(`input`): `Promise`\<`string`\>

Defined in: actions/secrets-actions.ts:143

Reveal a secret's plaintext value (audited).

## Parameters

### input

`unknown`

Payload validated by [RevealSecretSchema](../../../lib/validation/variables/RevealSecretSchema.md) (`confirm: "REVEAL"`).

## Returns

`Promise`\<`string`\>

Decrypted plaintext value.

## Throws

When session is missing, secret not found, or input fails validation.
