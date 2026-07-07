/**
 * Machine state client — refreshable host identity, services, and package inventory.
 */
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { getMachineStateAction } from "@/actions/host-actions";
import type { MachineStateData } from "./MachineStatePanel";
import { Cpu, Server, Package } from "lucide-react";
import { panelSubheaderClass } from "./panel-styles";

const panelClass =
  "rounded-[var(--md-sys-shape-corner-medium)] border border-border bg-[var(--md-sys-color-surface-variant)]/40 p-4";

/**
 * Hydrates from server-fetched state and supports manual refresh via host action.
 * @param props.initialData - Initial {@link MachineStateData} from the page.
 * @returns Refreshable machine state panel JSX.
 */
export function MachineStateClient({ initialData }: { initialData: MachineStateData }): React.JSX.Element {
  const [state, setState] = React.useState(initialData);
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await getMachineStateAction();
      setState(data);
      toast({
        title: "Refreshed",
        description: "Machine state updated.",
        variant: "success"
      });
    } catch (e) {
      toast({
        title: "Refresh failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const identityRows = [
    { label: "Hostname", value: state.identity?.hostname },
    { label: "GPU driver", value: state.identity?.nvidia }
  ].filter((r) => r.value);

  return (
    <div data-testid="machine-state-client">
      <div className="mb-4 flex justify-end">
        <Button onClick={refresh} disabled={loading} variant="outline" size="sm" className="text-xs">
          {loading ? "..." : "Refresh"}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
        {loading && <Skeleton className="col-span-full h-24" />}
        <div className={panelClass}>
          <div className={panelSubheaderClass}>
            <Cpu className="h-3.5 w-3.5 shrink-0" />
            IDENTITY + NVIDIA
          </div>
          <div className="space-y-1">
            {identityRows.map((row) => (
              <div key={row.label} className="flex justify-between border-b border-border py-0.5 last:border-0">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono text-foreground">{String(row.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={panelClass}>
          <div className={panelSubheaderClass}>
            <Server className="h-3.5 w-3.5 shrink-0" />
            SERVICES
          </div>
          <div className="max-h-40 overflow-auto">
            <div className="flex flex-wrap gap-1.5">
              {(state.services?.services || []).map((s, i) => (
                <Badge key={i} variant="outline" className="py-0.5 text-[10px]">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className={`${panelClass} md:col-span-2`}>
          <div className={panelSubheaderClass}>
            <Package className="h-3.5 w-3.5 shrink-0" />
            PACKAGES (sample)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(state.packages?.packages || []).slice(0, 30).map((p, i) => (
              <Badge key={i} variant="outline" className="py-0.5 text-[10px]">
                {p}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
