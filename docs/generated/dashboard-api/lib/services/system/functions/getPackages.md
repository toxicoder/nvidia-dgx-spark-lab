[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/system](../README.md) / getPackages

# Function: getPackages()

> **getPackages**(`limit?`): `Promise`\<[`PackageList`](../../../types/interfaces/PackageList.md)\>

Defined in: lib/services/system.ts:54

Sample installed Debian packages via `dpkg -l`.

## Parameters

### limit?

`number` = `50`

Maximum package names to return (default 50).

## Returns

`Promise`\<[`PackageList`](../../../types/interfaces/PackageList.md)\>

Package name list.
