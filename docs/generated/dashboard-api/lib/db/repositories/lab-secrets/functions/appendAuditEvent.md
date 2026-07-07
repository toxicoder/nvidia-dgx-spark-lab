[**dgx-lab-dashboard**](../../../../../README.md)

***

[dgx-lab-dashboard](../../../../../README.md) / [lib/db/repositories/lab-secrets](../README.md) / appendAuditEvent

# Function: appendAuditEvent()

> **appendAuditEvent**(`secretId`, `action`, `actorEmail`): `Promise`\<`void`\>

Defined in: lib/db/repositories/lab-secrets.ts:39

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
