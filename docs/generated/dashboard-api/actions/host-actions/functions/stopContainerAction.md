[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / stopContainerAction

# Function: stopContainerAction()

> **stopContainerAction**(`id`): `Promise`\<\{ `stopped`: `string`; \}\>

Defined in: [actions/host-actions.ts:75](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/actions/host-actions.ts#L75)

Stop a Docker container by id.

## Parameters

### id

`string`

Container id or name (validated via [ContainerIdSchema](../../../lib/validation/variables/ContainerIdSchema.md)).

## Returns

`Promise`\<\{ `stopped`: `string`; \}\>

Stop result with the container id.

## Throws

When session is missing or id fails validation.
