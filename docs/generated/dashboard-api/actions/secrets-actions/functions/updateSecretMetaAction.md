[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/secrets-actions](../README.md) / updateSecretMetaAction

# Function: updateSecretMetaAction()

> **updateSecretMetaAction**(`input`): `Promise`\<[`LabSecretMeta`](../../../lib/types/interfaces/LabSecretMeta.md)\>

Defined in: actions/secrets-actions.ts:103

Update secret description and/or K8s sync target (no value change).

## Parameters

### input

`unknown`

Payload validated by [UpdateSecretMetaSchema](../../../lib/validation/variables/UpdateSecretMetaSchema.md).

## Returns

`Promise`\<[`LabSecretMeta`](../../../lib/types/interfaces/LabSecretMeta.md)\>

Updated [LabSecretMeta](../../../lib/types/interfaces/LabSecretMeta.md).

## Throws

When session is missing or input fails validation.
