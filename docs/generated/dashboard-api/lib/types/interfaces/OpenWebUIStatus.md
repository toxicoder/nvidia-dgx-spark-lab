[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / OpenWebUIStatus

# Interface: OpenWebUIStatus

Defined in: lib/types/index.ts:253

## Properties

### backend

> **backend**: `object`

Defined in: lib/types/index.ts:265

#### hermes\_gateway

> **hermes\_gateway**: [`OpenWebUIBackendStatus`](OpenWebUIBackendStatus.md)

***

### error?

> `optional` **error?**: `string`

Defined in: lib/types/index.ts:271

***

### helm\_installed

> **helm\_installed**: `boolean`

Defined in: lib/types/index.ts:257

***

### namespace

> **namespace**: `string`

Defined in: lib/types/index.ts:255

***

### pod\_ready

> **pod\_ready**: `boolean`

Defined in: lib/types/index.ts:258

***

### prerequisites

> **prerequisites**: `object`

Defined in: lib/types/index.ts:268

#### hermes\_stack

> **hermes\_stack**: `string`

***

### release

> **release**: `string`

Defined in: lib/types/index.ts:254

***

### state

> **state**: [`OpenWebUIState`](../type-aliases/OpenWebUIState.md)

Defined in: lib/types/index.ts:256

***

### urls

> **urls**: `object`

Defined in: lib/types/index.ts:259

#### local?

> `optional` **local?**: `string`

#### nodeport

> **nodeport**: `string`

#### public?

> `optional` **public?**: `string` \| `null`

#### sso

> **sso**: `string`
