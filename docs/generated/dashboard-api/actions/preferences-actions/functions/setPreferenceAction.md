[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/preferences-actions](../README.md) / setPreferenceAction

# Function: setPreferenceAction()

> **setPreferenceAction**(`key`, `value`): `Promise`\<`void`\>

Defined in: [actions/preferences-actions.ts:30](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/preferences-actions.ts#L30)

Persist a user preference value.

## Parameters

### key

`string`

Preference key.

### value

`string`

String value to store.

## Returns

`Promise`\<`void`\>

Resolves when the value is written.

## Throws

When session is missing.
