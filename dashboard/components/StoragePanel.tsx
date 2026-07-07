"use client";

import type React from "react";
import { useState } from "react";
import { getStorageTreeAction, deletePathAction, findDuplicatesAction } from "@/actions/host-actions";
import Treemap from "./Treemap";
import { ErrorBoundary } from "./ErrorBoundary";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AlertDialog } from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, HardDrive, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { humanSize } from "@/lib/format";
import type { DuplicateFindResult, TreeNode } from "@/lib/types";

/**
 * StoragePanel (client) - **Full Storage Exploration & Cleanup Journey**.
 * - Recharts Nested Treemap + Sunburst toggle (top-level children laid out; nest drill on treemap)
 * - Click-to-select in charts + side list for delete
 * - Search / size filters affect list (charts show full hierarchy)
 * - Delete (single/bulk) with MD3 AlertDialog confirm + loading
 * - Find Duplicates with nice Sheet results
 * - Refresh with Skeleton
 * - Toast feedback
 * Responsive via the charts + components.
 */
interface StoragePanelProps {
  initialTree: TreeNode;
  /** Dev/visual fixture: pre-open dupes sheet with given result. */
  visualDupesFixture?: DuplicateFindResult | null;
  visualShowDupesSheet?: boolean;
}

/**
 * Client storage explorer with treemap, delete, and duplicate-finder flows.
 * @param props.initialTree - Pre-fetched storage tree root.
 * @param props.visualDupesFixture - Dev fixture: pre-populate dupes sheet data.
 * @param props.visualShowDupesSheet - Dev fixture: open dupes sheet on mount.
 * @returns Storage panel JSX.
 */
export function StoragePanel({
  initialTree,
  visualDupesFixture,
  visualShowDupesSheet = false
}: StoragePanelProps): React.JSX.Element {
  const [tree, setTree] = useState(initialTree);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  // For delete journey
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // For dupes journey
  const [dupes, setDupes] = useState<DuplicateFindResult | null>(visualDupesFixture ?? null);
  const [showDupesSheet, setShowDupesSheet] = useState(visualShowDupesSheet);

  async function confirmDelete(path: string) {
    setPendingDelete(path);
  }

  async function performDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const fd = new FormData();
      fd.append("path", pendingDelete);
      await deletePathAction(fd);
      toast({ title: "Deleted", description: "Path moved to trash.", variant: "success" });
      await refresh();
    } catch (e) {
      toast({ title: "Delete failed", description: String(e), variant: "error" });
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }

  async function handleFindDupes() {
    setIsRefreshing(true);
    const res = await findDuplicatesAction();
    setDupes(res);
    setShowDupesSheet(true);
    setIsRefreshing(false);

    return res;
  }

  async function refresh() {
    setIsRefreshing(true);
    const fresh = await getStorageTreeAction({ path: "/mnt/models" });
    setTree(fresh);
    setIsRefreshing(false);
  }

  const pathSegments = (tree.path || "/mnt/models").split("/").filter(Boolean);

  return (
    <div data-testid="storage-panel" className="w-full self-start">
      <nav
        data-testid="storage-path-breadcrumb"
        aria-label="Storage directory"
        className="mb-3 flex min-w-0 flex-wrap items-center gap-1 rounded-full border border-[var(--md-sys-color-outline-variant)]/60 bg-[var(--md-sys-color-surface-variant)]/40 px-2.5 py-1.5 text-[10px] font-medium text-[var(--md-sys-color-on-surface-variant)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <HardDrive className="h-3 w-3 shrink-0 text-[var(--md-sys-color-primary)]" aria-hidden />
        <span className="text-[var(--md-sys-color-on-surface-variant)]">/</span>
        {pathSegments.map((segment, i) => (
          <span key={`${segment}-${i}`} className="inline-flex min-w-0 items-center gap-1">
            {i > 0 ? <ChevronRight className="h-2.5 w-2.5 shrink-0 opacity-50" aria-hidden /> : null}
            <span
              className={cn(
                "truncate",
                i === pathSegments.length - 1
                  ? "rounded-full bg-[var(--md-sys-color-primary-container)] px-2 py-0.5 text-[var(--md-sys-color-on-primary-container)]"
                  : "text-[var(--md-sys-color-on-surface)]"
              )}
            >
              {segment}
            </span>
          </span>
        ))}
      </nav>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0 text-xs text-muted-foreground">
          Disk usage — toggle Treemap / Sunburst. Click tiles to drill or select.
        </div>
        <Button onClick={refresh} disabled={isRefreshing} variant="outline" size="sm" className="text-xs">
          <RefreshCw className="mr-1 h-3 w-3" /> {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {isRefreshing && <Skeleton className="h-8 w-full mb-2" />}

      {/* Wrapped for lightweight viz isolation. See ErrorBoundary.tsx + enhanced error.tsx */}
      <ErrorBoundary
        fallback={<div className="text-xs text-destructive p-2">Treemap render error (isolated; try refresh).</div>}
      >
        <Treemap root={tree} onDelete={confirmDelete} onFindDuplicates={handleFindDupes} />
      </ErrorBoundary>

      {/* Delete confirm for Storage journey */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete path?"
        description={`Move ${pendingDelete} to trash? This is destructive.`}
        confirmText={isDeleting ? "Deleting..." : "Delete"}
        onConfirm={performDelete}
        variant="destructive"
      />

      {/* Dupes results Sheet for nice journey display */}
      <Sheet open={showDupesSheet} onOpenChange={setShowDupesSheet} side="right" title="Duplicate Groups">
        {!dupes || !dupes.groups || dupes.groups.length === 0 ? (
          <div>No duplicates found.</div>
        ) : (
          <div className="space-y-3 text-sm">
            {dupes.groups.slice(0, 10).map((g, i) => (
              <div
                key={i}
                className="p-2 border border-[var(--md-sys-color-outline-variant)] rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-variant)]"
              >
                <div className="font-medium text-[var(--md-sys-color-on-surface)]">
                  {humanSize(g.size)} — {g.files.length} files
                </div>
                <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1 break-all">
                  {g.files.join(", ")}
                </div>
              </div>
            ))}
            {dupes.groups.length > 10 && <div className="text-xs text-muted-foreground">... and more</div>}
          </div>
        )}
      </Sheet>
    </div>
  );
}
