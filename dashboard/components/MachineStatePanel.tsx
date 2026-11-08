/**
 * Machine State panel — host identity, services, and package inventory.
 * Initial data from page-level fetch; {@link MachineStateClient} handles refresh.
 */
import type React from "react";
import { MachineStateClient } from "./MachineStateClient";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import type { getMachineIdentity, getRunningServices, getPackages } from "@/lib/host";

/** Props bundle for machine state panels (pre-fetched at page level). */
export type MachineStateData = {
  identity: Awaited<ReturnType<typeof getMachineIdentity>>;
  services: Awaited<ReturnType<typeof getRunningServices>>;
  packages: Awaited<ReturnType<typeof getPackages>>;
};

/**
 * Server wrapper that renders {@link MachineStateClient} with initial data.
 * @param props.initialData - Pre-fetched identity, services, and packages.
 * @returns Machine state panel JSX.
 */
export function MachineStatePanel({ initialData }: { initialData: MachineStateData }): React.JSX.Element {
  return (
    <Panel data-testid="machine-state-panel" className="w-full self-start">
      <PanelHeader>
        <PanelTitle>Machine state</PanelTitle>
      </PanelHeader>
      <PanelBody>
        <MachineStateClient initialData={initialData} />
      </PanelBody>
    </Panel>
  );
}
