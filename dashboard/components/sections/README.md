# `components/sections/` — one module per console section

Every route under `app/(dashboard)/[section]/` renders exactly one module from this
directory. The section list is the closed set `DASHBOARD_SECTIONS` in
`lib/types/index.ts`; the rail text and document titles come from
`lib/section-registry.ts`.

## The contract

Each `components/sections/<slug>/index.tsx` default-exports an async server component
matching `SectionView` from `lib/section-registry.ts`. A module is a **data loader with a
failure state**: it reads host state and hands it to panels. It renders no frame of its
own, because the panel that owns the data also owns the heading and the refresh button
beside it.

```tsx
import type React from "react";

import { getClusterCapacity, getMonitoringStackStatus } from "@/lib/host";
import { attempt, sectionFailureMessage } from "@/lib/section-result";
import { ResourcesPanel } from "@/components/ResourcesPanel";
import { SectionFailure } from "@/components/SectionFailure";

/**
 * Resource Guard section — cluster headroom and the monitoring stack behind it.
 * @returns The section's panels, rendered with freshly read host state.
 */
export default async function ResourcesSection(): Promise<React.JSX.Element> {
  const [capacity, monitoring] = await Promise.all([attempt(getClusterCapacity), attempt(getMonitoringStackStatus)]);

  if (!capacity.ok) {
    return <SectionFailure title="Resource Guard" message={sectionFailureMessage("resources", capacity.error)} />;
  }

  return (
    <ResourcesPanel initialCapacity={capacity.data} {...(monitoring.ok ? { monitoringStatus: monitoring.data } : {})} />
  );
}
```

Rules that follow from that shape, all of which the tests enforce:

- **Load your own data here.** The route passes no props. This is what lets a route's
  `error.tsx` take down one section while the rest of the console survives, which is the
  reason the sections were moved out of the single `page.tsx` in the first place.
- **Never import another section.** Shared code goes in `components/ui/` or `lib/`.
- **Frame ownership is one level down.** A module renders neither the page heading nor a
  `Panel`. The route owns the `<h1>` (`components/PageHeader.tsx`), and each
  `components/*Panel.tsx` owns its own `Panel` / `PanelHeader` / `PanelTitle` / `PanelBody`,
  whose title is the `<h2>`. Wrapping a panel that already frames itself produces two
  stacked headings, which is the defect this rule exists to prevent.
- **Wrap every host call in `attempt()`** from `lib/section-result.ts`, so one failing
  probe degrades to `SectionFailure` with a working retry rather than throwing past the
  route boundary and blanking the page.
- Keep every existing `data-testid` on the panel you render. Visual goldens and
  `//tests:safety_invariants` both key off them.

## Route map

| Slug            | Module                    | Reads                                                                                               |
| --------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| `resources`     | `resources/index.tsx`     | `getClusterCapacity`, `getMonitoringStackStatus`                                                    |
| `observability` | `observability/index.tsx` | `getMonitoringStackStatus`                                                                          |
| `inference`     | `inference/index.tsx`     | `getInferenceWorkloadsStatus`, `getClusterCapacity`, `getNemotronCatalog`, `getNemotronStackStatus` |
| `agent-chat`    | `agent-chat/index.tsx`    | `getOpenWebUIStatus`                                                                                |
| `storage`       | `storage/index.tsx`       | `getStorageTree("/mnt/models")`                                                                     |
| `tasks`         | `tasks/index.tsx`         | `listContainers`, `listOllamaModels`                                                                |
| `workspaces`    | `workspaces/index.tsx`    | `getDevWorkspacesStatus`                                                                            |
| `system`        | `system/index.tsx`        | `getMachineIdentity`, `getRunningServices`, `getPackages`                                           |
| `utilities`     | `utilities/index.tsx`     | nothing (client-driven)                                                                             |
| `secrets`       | `secrets/index.tsx`       | `listSecrets`                                                                                       |

The router in `app/(dashboard)/[section]/page.tsx` imports all ten and switches on the
validated slug. It is the only file allowed to know all ten at once.
