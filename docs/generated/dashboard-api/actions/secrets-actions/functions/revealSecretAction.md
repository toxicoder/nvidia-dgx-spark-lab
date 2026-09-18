[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/secrets-actions](../README.md) / revealSecretAction

# Function: revealSecretAction()

> **revealSecretAction**(`input`): `Promise`\<`string`\>

Defined in: [actions/secrets-actions.ts:143](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/secrets-actions.ts#L143)

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
