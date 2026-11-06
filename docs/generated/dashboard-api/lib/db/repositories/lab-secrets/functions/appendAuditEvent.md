[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / appendAuditEvent

# Function: appendAuditEvent()

> **appendAuditEvent**(`secretId`, `action`, `actorEmail`): `Promise`\<`void`\>

Defined in: [lib/db/repositories/lab-secrets.ts:39](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/db/repositories/lab-secrets.ts#L39)

Record a secrets vault audit event for the given actor.

## Parameters

### secretId

`string` \| `null`

### action

[`SecretAuditAction`](../../../../types/type-aliases/SecretAuditAction.md)

### actorEmail

`string`

## Returns

`Promise`\<`void`\>
