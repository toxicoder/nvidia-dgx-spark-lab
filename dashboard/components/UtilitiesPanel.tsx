/**
 * Utilities panel (server) — lists discovered lab scripts and recent run history.
 */
import type React from "react";
import { listUtilities } from "@/lib/host";
import { getLatestUtilityRunsByName, listRecentUtilityRuns } from "@/lib/db/repositories/utility-runs";
import { Badge } from "@/components/ui/badge";
import { UtilityRow } from "./UtilityRow";
import { UtilityRunHistory } from "./UtilityRunHistory";
import { panelSubheaderClass } from "./panel-styles";

/**
 * Fetches utility catalog and run records; renders rows with per-script last-run metadata.
 * @returns Utilities panel server component JSX.
 */
export async function UtilitiesPanel(): Promise<React.JSX.Element> {
  const utils = listUtilities();
  const recentRuns = await listRecentUtilityRuns(10);
  const latestByName = await getLatestUtilityRunsByName(utils.map((u) => u.name));

  return (
    <div data-testid="utilities-panel" className="w-full self-start space-y-4">
      <div className={panelSubheaderClass}>
        UTILITY SCRIPTS
        <Badge variant="secondary" className="text-[10px]">
          lab pattern
        </Badge>
      </div>

      {utils.length === 0 && (
        <div className="text-xs text-muted-foreground">
          No utilities discovered (place scripts in scripts/utilities/)
        </div>
      )}

      <div className="space-y-3">
        {utils.map((u) => (
          <div key={u.name} className="rounded-[var(--md-sys-shape-corner-medium)] border border-border bg-card p-4">
            <UtilityRow utility={u} lastRun={latestByName.get(u.name)} />
          </div>
        ))}
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-muted-foreground">Recent runs</div>
        <UtilityRunHistory runs={recentRuns} />
      </div>
    </div>
  );
}
