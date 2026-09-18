[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / stopContainerAction

# Function: stopContainerAction()

> **stopContainerAction**(`id`): `Promise`\<\{ `stopped`: `string`; \}\>

Defined in: [actions/host-actions.ts:75](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/host-actions.ts#L75)

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
