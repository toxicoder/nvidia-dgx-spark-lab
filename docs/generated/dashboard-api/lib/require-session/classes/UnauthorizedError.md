[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/require-session](../README.md) / UnauthorizedError

# Class: UnauthorizedError

Defined in: [lib/require-session.ts:5](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/require-session.ts#L5)

Thrown when a server action requires auth but no session is available.

## Extends

- `Error`

## Constructors

### Constructor

> **new UnauthorizedError**(`message?`): `UnauthorizedError`

Defined in: [lib/require-session.ts:6](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/require-session.ts#L6)

#### Parameters

##### message?

`string` = `"Unauthorized"`

#### Returns

`UnauthorizedError`

#### Overrides

`Error.constructor`
