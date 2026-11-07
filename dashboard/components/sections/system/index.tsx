import type React from "react";

import { MachineStatePanel, type MachineStateData } from "@/components/MachineStatePanel";
import { SectionFailure } from "@/components/SectionFailure";
import { getMachineIdentity, getPackages, getRunningServices } from "@/lib/host";
import { attempt, firstError, sectionFailureMessage } from "@/lib/section-result";

/**
 * Machine State section: host identity, running services, installed packages.
 *
 * @returns The machine state panel, or a failure state with retry.
 */
export default async function SystemSection(): Promise<React.JSX.Element> {
  const [identity, services, packages] = await Promise.all([
    attempt(getMachineIdentity),
    attempt(getRunningServices),
    attempt(getPackages)
  ]);

  if (!identity.ok || !services.ok || !packages.ok) {
    return (
      <SectionFailure
        title="Machine State"
        message={sectionFailureMessage("system", firstError([identity, services, packages]))}
      />
    );
  }

  const initialData: MachineStateData = {
    identity: identity.data,
    services: services.data,
    packages: packages.data
  };

  return <MachineStatePanel initialData={initialData} />;
}
