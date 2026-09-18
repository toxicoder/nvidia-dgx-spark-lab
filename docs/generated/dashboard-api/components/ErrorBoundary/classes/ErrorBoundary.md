[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [components/ErrorBoundary](../README.md) / ErrorBoundary

# Class: ErrorBoundary

Defined in: [components/ErrorBoundary.tsx:33](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/components/ErrorBoundary.tsx#L33)

React error boundary that isolates render failures in dashboard subtrees.

## Extends

- `Component`\<`ErrorBoundaryProps`, `ErrorBoundaryState`\>

## Constructors

### Constructor

> **new ErrorBoundary**(`props`): `ErrorBoundary`

Defined in: [components/ErrorBoundary.tsx:34](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/components/ErrorBoundary.tsx#L34)

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

Defined in: [components/ErrorBoundary.tsx:43](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/components/ErrorBoundary.tsx#L43)

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

Defined in: [components/ErrorBoundary.tsx:48](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/components/ErrorBoundary.tsx#L48)

#### Returns

`string` \| `number` \| `bigint` \| `boolean` \| `Iterable`\<`ReactNode`, `any`, `any`\> \| `Promise`\<`AwaitedReactNode`\> \| `Element` \| `null` \| `undefined`

#### Overrides

`React.Component.render`

***

### getDerivedStateFromError()

> `static` **getDerivedStateFromError**(`error`): `ErrorBoundaryState`

Defined in: [components/ErrorBoundary.tsx:39](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/components/ErrorBoundary.tsx#L39)

#### Parameters

##### error

`Error`

#### Returns

`ErrorBoundaryState`
