[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/preferences-actions](../README.md) / getPreferenceAction

# Function: getPreferenceAction()

> **getPreferenceAction**(`key`): `Promise`\<`string` \| `null`\>

Defined in: [actions/preferences-actions.ts:18](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/preferences-actions.ts#L18)

Read a user preference by key.

## Parameters

### key

`string`

Preference key (e.g. theme storage key).

## Returns

`Promise`\<`string` \| `null`\>

Stored value or `null` when unset.

## Throws

When session is missing.
