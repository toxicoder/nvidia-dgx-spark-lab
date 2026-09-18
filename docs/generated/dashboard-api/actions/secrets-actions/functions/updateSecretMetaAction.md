[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/secrets-actions](../README.md) / updateSecretMetaAction

# Function: updateSecretMetaAction()

> **updateSecretMetaAction**(`input`): `Promise`\<[`LabSecretMeta`](../../../lib/types/interfaces/LabSecretMeta.md)\>

Defined in: [actions/secrets-actions.ts:103](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/secrets-actions.ts#L103)

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
