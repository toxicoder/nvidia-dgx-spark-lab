[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [actions/host-actions](../README.md) / runUtilityAction

# Function: runUtilityAction()

> **runUtilityAction**(`name`, `subcommand?`): `Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Defined in: [actions/host-actions.ts:155](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/actions/host-actions.ts#L155)

Run a lab utility script with optional subcommand args.

## Parameters

### name

`string`

Utility script name (without `.sh`).

### subcommand?

`string`

Optional extra CLI args passed to the script.

## Returns

`Promise`\<[`UtilityRunResult`](../../../lib/types/interfaces/UtilityRunResult.md)\>

Captured stdout, stderr, and exit code.

## Throws

When session is missing or name is not in the allowlist.
