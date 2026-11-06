[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/cli-json](../README.md) / CliPayloadError

# Class: CliPayloadError

Defined in: [lib/services/cli-json.ts:367](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L367)

Raised when a utility's stdout does not match the shape the dashboard assumes.

## Extends

- `Error`

## Constructors

### Constructor

> **new CliPayloadError**(`utility`, `reason`): `CliPayloadError`

Defined in: [lib/services/cli-json.ts:372](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L372)

#### Parameters

##### utility

`string`

Name of the utility whose output was rejected.

##### reason

`string`

Human-readable summary of the schema failures.

#### Returns

`CliPayloadError`

#### Overrides

`Error.constructor`

## Properties

### reason

> `readonly` **reason**: `string`

Defined in: [lib/services/cli-json.ts:374](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L374)

Human-readable summary of the schema failures.

***

### utility

> `readonly` **utility**: `string`

Defined in: [lib/services/cli-json.ts:373](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/cli-json.ts#L373)

Name of the utility whose output was rejected.
