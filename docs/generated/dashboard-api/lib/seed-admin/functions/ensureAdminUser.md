[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/seed-admin](../README.md) / ensureAdminUser

# Function: ensureAdminUser()

> **ensureAdminUser**(): `Promise`\<`void`\>

Defined in: [lib/seed-admin.ts:11](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/seed-admin.ts#L11)

Create the initial admin user when LAB_DASHBOARD_ADMIN_* env vars are set
and no users exist yet. Idempotent — safe on every request.

## Returns

`Promise`\<`void`\>
