import type React from "react";

import { UtilitiesPanel } from "@/components/UtilitiesPanel";

/**
 * Utilities section: allow-listed maintenance scripts and past run output.
 *
 * Nothing is fetched here. Utilities are allow-listed and run on demand from the
 * client, so the route renders instantly and stays honest about having no data
 * until the operator runs something.
 *
 * @returns The utilities panel.
 */
export default function UtilitiesSection(): React.JSX.Element {
  return <UtilitiesPanel />;
}
