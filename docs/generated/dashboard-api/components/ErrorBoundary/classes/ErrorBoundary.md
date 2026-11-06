[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [components/ErrorBoundary](../README.md) / ErrorBoundary

# Class: ErrorBoundary

Defined in: [components/ErrorBoundary.tsx:34](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/components/ErrorBoundary.tsx#L34)

React error boundary that isolates render failures in dashboard subtrees.

## Extends

- `Component`\<`ErrorBoundaryProps`, `ErrorBoundaryState`\>

## Constructors

### Constructor

> **new ErrorBoundary**(`props`): `ErrorBoundary`

Defined in: [components/ErrorBoundary.tsx:35](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/components/ErrorBoundary.tsx#L35)

#### Parameters

##### props

`ErrorBoundaryProps`

#### Returns

`ErrorBoundary`

#### Overrides

`React.Component<ErrorBoundaryProps, ErrorBoundaryState>.constructor`

## Methods

### componentDidCatch()

> **componentDidCatch**(`error`, `errorInfo`): `void`

Defined in: [components/ErrorBoundary.tsx:44](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/components/ErrorBoundary.tsx#L44)

Catches exceptions generated in descendant components. Unhandled exceptions will cause
the entire component tree to unmount.

#### Parameters

##### error

`Error`

##### errorInfo

`ErrorInfo`

#### Returns

`void`

#### Overrides

`React.Component.componentDidCatch`

***

### render()

> **render**(): `string` \| `number` \| `bigint` \| `boolean` \| `Iterable`\<`ReactNode`, `any`, `any`\> \| `Promise`\<`AwaitedReactNode`\> \| `Element` \| `null` \| `undefined`

Defined in: [components/ErrorBoundary.tsx:49](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/components/ErrorBoundary.tsx#L49)

#### Returns

`string` \| `number` \| `bigint` \| `boolean` \| `Iterable`\<`ReactNode`, `any`, `any`\> \| `Promise`\<`AwaitedReactNode`\> \| `Element` \| `null` \| `undefined`

#### Overrides

`React.Component.render`

***

### getDerivedStateFromError()

> `static` **getDerivedStateFromError**(`error`): `ErrorBoundaryState`

Defined in: [components/ErrorBoundary.tsx:40](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/components/ErrorBoundary.tsx#L40)

#### Parameters

##### error

`Error`

#### Returns

`ErrorBoundaryState`
