/**
 * Docker container table for the Tasks panel — compact list with stop actions.
 */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { stopContainerAction } from "@/actions/host-actions";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StopCircle } from "lucide-react";
import type { DockerContainer, DockerListResult } from "@/lib/types";

interface ContainerListProps {
  data: DockerListResult;
}

const compactTableClass = "table-fixed w-full min-w-0 [&_th]:h-8 [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1.5";

function shortStatus(status?: string): string {
  if (!status) return "unknown";
  const token = status.trim().split(/\s+/)[0];
  return token || status;
}

function isDockerError(data: DockerListResult): data is { error: string } {
  return !Array.isArray(data) && "error" in data;
}

/** Renders up to 12 containers with status badges and confirmed stop controls. */
export function TasksContainerList({ data }: ContainerListProps) {
  if (isDockerError(data)) {
    return <div className="text-xs text-destructive">{data.error}</div>;
  }

  const containers = data.slice(0, 12);

  return (
    <Table data-testid="tasks-container-list" className={compactTableClass}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50%] text-xs">Container</TableHead>
          <TableHead className="w-[22%] text-xs">Status</TableHead>
          <TableHead className="w-[28%] text-right text-xs">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {containers.map((c: DockerContainer, i: number) => {
          const id = c.ID;
          const displayName = c.Names || id;
          return <ContainerRow key={id || i} id={id} displayName={displayName} status={c.Status} />;
        })}
      </TableBody>
    </Table>
  );
}

function ContainerRow({ id, displayName, status }: { id: string; displayName: string; status?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isStopping, setIsStopping] = React.useState(false);
  const { toast } = useToast();

  const handleConfirm = async () => {
    setIsStopping(true);
    try {
      await stopContainerAction(id);
      toast({
        title: "Container stopped",
        description: `${displayName} stopped successfully.`,
        variant: "success"
      });
      router.refresh();
    } catch (e) {
      toast({
        title: "Failed to stop",
        description: String(e),
        variant: "error"
      });
    } finally {
      setIsStopping(false);
      setOpen(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="truncate font-mono text-xs">{displayName}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="max-w-[6rem] truncate whitespace-nowrap px-1.5 py-0 text-[10px] leading-none"
          title={status || "unknown"}
        >
          {shortStatus(status)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          onClick={() => setOpen(true)}
          aria-label={`Stop ${displayName}`}
        >
          <StopCircle className="h-3.5 w-3.5" />
        </Button>
        <AlertDialog
          open={open}
          onOpenChange={setOpen}
          title="Stop container?"
          description={`This will stop ${displayName}. It can usually be restarted later.`}
          confirmText={isStopping ? "Stopping..." : "Stop container"}
          onConfirm={handleConfirm}
          variant="destructive"
        />
      </TableCell>
    </TableRow>
  );
}
