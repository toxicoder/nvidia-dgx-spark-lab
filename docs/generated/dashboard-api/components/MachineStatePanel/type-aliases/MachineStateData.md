[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [components/MachineStatePanel](../README.md) / MachineStateData

# Type Alias: MachineStateData

> **MachineStateData** = `object`

Defined in: [components/MachineStatePanel.tsx:10](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/components/MachineStatePanel.tsx#L10)

Props bundle for machine state panels (pre-fetched at page level).

## Properties

### identity

> **identity**: `Awaited`\<`ReturnType`\<*typeof* [`getMachineIdentity`](../../../lib/services/system/functions/getMachineIdentity.md)\>\>

Defined in: [components/MachineStatePanel.tsx:11](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/components/MachineStatePanel.tsx#L11)

***

### packages

> **packages**: `Awaited`\<`ReturnType`\<*typeof* [`getPackages`](../../../lib/services/system/functions/getPackages.md)\>\>

Defined in: [components/MachineStatePanel.tsx:13](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/components/MachineStatePanel.tsx#L13)

***

### services

> **services**: `Awaited`\<`ReturnType`\<*typeof* [`getRunningServices`](../../../lib/services/system/functions/getRunningServices.md)\>\>

Defined in: [components/MachineStatePanel.tsx:12](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/components/MachineStatePanel.tsx#L12)
