[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / appendAuditEvent

# Function: appendAuditEvent()

> **appendAuditEvent**(`secretId`, `action`, `actorEmail`): `Promise`\<`void`\>

Defined in: [lib/db/repositories/lab-secrets.ts:39](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/db/repositories/lab-secrets.ts#L39)

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
