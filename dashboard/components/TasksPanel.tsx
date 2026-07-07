/**
 * Tasks panel — Docker containers and Ollama model inventory.
 * Data is fetched at page level; this component is presentational only.
 */
import type React from "react";
import type { listContainers, listOllamaModels } from "@/lib/host";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TasksContainerList } from "@/components/TasksContainerList";
import { panelSubheaderClass } from "./panel-styles";

/** Props bundle for {@link TasksPanel} (pre-fetched at page level). */
export type TasksPanelData = {
  containers: Awaited<ReturnType<typeof listContainers>>;
  ollama: Awaited<ReturnType<typeof listOllamaModels>>;
};

const compactTableClass = "table-fixed w-full [&_th]:h-8 [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1.5";

/**
 * Render Docker container list and Ollama model table.
 * @param props - Pre-fetched container and Ollama data.
 * @returns Tasks panel JSX.
 */
export function TasksPanel({ containers, ollama }: TasksPanelData): React.JSX.Element {
  const raw = ollama?.raw || "";
  const lines = raw.trim().split(/\n+/);
  const dataLines = lines.slice(1);

  return (
    <div
      data-testid="tasks-panel"
      className="@container grid w-full min-w-0 self-start grid-cols-1 gap-4 @5xl:grid-cols-2"
    >
      <div className="min-w-0">
        <div className={panelSubheaderClass}>
          CONTAINERS (docker)
          <Badge variant="outline" className="text-[10px]">
            docker
          </Badge>
        </div>
        <TasksContainerList data={containers} />
      </div>

      <div className="min-w-0">
        <div className={panelSubheaderClass}>OLLAMA</div>
        {!dataLines.length ? (
          <div className="text-xs text-muted-foreground">No models (mock)</div>
        ) : (
          <Table className={compactTableClass}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[55%] text-xs">Model</TableHead>
                <TableHead className="w-[45%] text-xs">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataLines.map((line: string, i: number) => {
                const parts = line.split(/\t+/);
                return (
                  <TableRow key={i}>
                    <TableCell className="truncate font-mono text-xs">{parts[0] || ""}</TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">{parts[2] || ""}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
