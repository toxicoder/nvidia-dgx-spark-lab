[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/services/system](../README.md) / getPackages

# Function: getPackages()

> **getPackages**(`limit?`): `Promise`\<[`PackageList`](../../../types/interfaces/PackageList.md)\>

Defined in: [lib/services/system.ts:54](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/services/system.ts#L54)

Sample installed Debian packages via `dpkg -l`.

## Parameters

### limit?

`number` = `50`

Maximum package names to return (default 50).

## Returns

`Promise`\<[`PackageList`](../../../types/interfaces/PackageList.md)\>

Package name list.
