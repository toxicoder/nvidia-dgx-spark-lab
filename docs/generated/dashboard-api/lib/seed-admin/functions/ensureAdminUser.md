[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/seed-admin](../README.md) / ensureAdminUser

# Function: ensureAdminUser()

> **ensureAdminUser**(): `Promise`\<`void`\>

Defined in: lib/seed-admin.ts:11

Create the initial admin user when LAB_DASHBOARD_ADMIN_* env vars are set
and no users exist yet. Idempotent — safe on every request.

## Returns

`Promise`\<`void`\>
