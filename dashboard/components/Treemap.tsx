"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { humanSize } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderOpen, Trash2 } from "lucide-react";
import { Treemap as RechartsTreemap, SunburstChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DuplicateFindResult, TreeNode } from "@/lib/types";

// Local precise types for Recharts integration (avoids any).
// TreemapContent receives TreemapNode-like (x/y/width/height/depth + our fields + optional payload wrapper).
// Click handlers receive node or synthetic event objects (Treemap vs Sunburst differ slightly).
interface RechartsChartNode {
  name?: string;
  value?: number | string;
  path?: string;
  isDir?: boolean;
  fill?: string;
  depth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

type RechartsDataNode = {
  name: string;
  value: number;
  path: string;
  isDir: boolean;
  fill: string;
  children?: RechartsDataNode[];
};

/** Chart fills aligned with active theme MD3 tokens (CSS vars work in SVG fill attributes). */
const TREEMAP_COLOR_PALETTE = [
  "var(--md-sys-color-primary)",
  "var(--md-sys-color-primary-container)",
  "var(--md-sys-color-tertiary)",
  "var(--md-sys-color-secondary)",
  "var(--md-sys-color-secondary-container)",
  "var(--md-sys-color-tertiary-container)"
];

const SUNBURST_SEGMENT_PALETTE = [
  "var(--md-sys-color-primary)",
  "var(--md-sys-color-primary-container)",
  "var(--md-sys-color-tertiary)",
  "var(--md-sys-color-secondary)",
  "var(--md-sys-color-tertiary-container)",
  "var(--md-sys-color-secondary-container)",
  "var(--md-sys-color-inverse-primary)"
];

const SUNBURST_SELECTED_FILL = "var(--md-sys-color-inverse-primary)";

const SUNBURST_MAX_SEGMENTS = 7;

type SunburstSegment = RechartsDataNode & {
  displayName: string;
  shortName: string;
};

function truncateSunburstName(name: string, max = 12): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

/** Exported for unit tests (Recharts tooltip formatter). */
export function treemapTooltipFormatter(value: unknown): [string, string] {
  return [humanSize(Number(value ?? 0)), "Size"];
}

/** Exported for unit tests (breadcrumb label when name is "root"). */
export function treemapNestCrumbLabel(item: RechartsChartNode, rootName: string): string {
  const raw = item.name || "root";
  if (raw === "root") return rootName;
  return raw;
}

function renderTreemapNestCrumb(item: RechartsChartNode, index: number, rootName: string) {
  const label = treemapNestCrumbLabel(item, rootName);
  return (
    <span className="inline-flex max-w-[9rem] items-center gap-1 truncate">
      {index === 0 ? <FolderOpen className="h-3 w-3 shrink-0 opacity-90" aria-hidden /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

function SunburstLegend({ segments, totalSize }: { segments: SunburstSegment[]; totalSize: number }) {
  if (segments.length === 0) return null;
  return (
    <div
      data-testid="sunburst-legend"
      className="grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-[var(--md-sys-color-outline-variant)]/60 bg-[var(--md-sys-color-surface-variant)]/30 px-2.5 py-2"
    >
      {segments.map((seg) => {
        const pct = totalSize > 0 ? (seg.value / totalSize) * 100 : 0;
        return (
          <div key={seg.path} className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-1.5 text-[10px] leading-tight">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-[var(--md-sys-color-outline-variant)]"
                style={{ background: seg.fill }}
                aria-hidden
              />
              <span className="truncate font-medium text-[var(--md-sys-color-on-surface)]" title={seg.displayName}>
                {seg.shortName}
              </span>
              <span className="ml-auto shrink-0 tabular-nums text-[var(--md-sys-color-on-surface-variant)]">
                {humanSize(seg.value)}
              </span>
              <span className="w-9 shrink-0 text-right tabular-nums text-[var(--md-sys-color-primary)]">
                {pct < 10 ? pct.toFixed(1) : Math.round(pct)}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[var(--md-sys-color-outline-variant)]/40" aria-hidden>
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{ width: `${Math.min(pct, 100)}%`, background: seg.fill }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SunburstCenterHub({ totalLabel, itemCount }: { totalLabel: string; itemCount: number }) {
  return (
    <div
      data-testid="sunburst-center"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div className="flex min-w-[4rem] flex-col items-center rounded-full border border-[var(--md-sys-color-outline-variant)]/70 bg-[var(--md-sys-color-surface)]/95 px-3 py-2 text-center shadow-[0_0_0_3px_var(--md-sys-color-surface),0_2px_12px_rgba(0,0,0,0.35)] backdrop-blur-[3px] sm:min-w-[5.5rem] sm:px-4 sm:py-3">
        <span className="text-[7px] font-semibold uppercase tracking-[0.12em] text-[var(--md-sys-color-on-surface-variant)] sm:text-[8px]">
          Total
        </span>
        <span className="text-sm font-bold tabular-nums leading-tight text-[var(--md-sys-color-primary)] sm:text-base">
          {totalLabel}
        </span>
        <span className="mt-0.5 text-[9px] text-[var(--md-sys-color-on-surface-variant)]">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>
    </div>
  );
}

function toRechartsData(node: TreeNode, depth = 0): RechartsDataNode {
  const children =
    node.children && node.children.length > 0 ? node.children.map((c) => toRechartsData(c, depth + 1)) : undefined;
  const hasChildren = Boolean(children?.length);
  // Container nodes paint the gap between rounded child tiles — use surface, not primary.
  const fill = hasChildren
    ? "var(--md-sys-color-surface)"
    : TREEMAP_COLOR_PALETTE[depth % TREEMAP_COLOR_PALETTE.length];
  return {
    name: node.name,
    value: Math.max(node.size || 0, 1),
    path: node.path,
    isDir: node.isDir,
    fill,
    children
  };
}

interface TreemapCellContentProps extends RechartsChartNode {
  selectedPaths: Set<string>;
}

/** Custom Recharts treemap cell renderer with selection highlighting. */
export function TreemapCellContent({ selectedPaths, ...props }: TreemapCellContentProps) {
  const x = (props.x as number) || 0;
  const y = (props.y as number) || 0;
  const width = (props.width as number) || 0;
  const height = (props.height as number) || 0;
  const payload = props.payload as RechartsChartNode | undefined;
  const name = (props.name as string) || payload?.name || "";
  const rawValue = (props.value as number) ?? (payload?.value as number) ?? 0;
  const value = Number(rawValue) || 0;
  const path = (props.path as string) || payload?.path || "";
  const isSelected = selectedPaths.has(path);
  const depth = typeof props.depth === "number" ? (props.depth as number) : 0;
  const baseFill = TREEMAP_COLOR_PALETTE[depth % TREEMAP_COLOR_PALETTE.length];
  const fill = isSelected ? "var(--md-sys-color-inverse-primary)" : baseFill;
  const showText = width > 36 && height > 18;
  const label = name ? (name.length > 13 ? name.slice(0, 10) + "…" : name) : "";
  const tooltipLabel = name ? `${name} — ${humanSize(value)}` : humanSize(value);
  const inset = 1;
  const cellW = Math.max(width - inset * 2, 1);
  const cellH = Math.max(height - inset * 2, 1);
  const corner = Math.min(8, Math.floor(Math.min(cellW, cellH) * 0.14), 6);
  return (
    <g className="treemap-cell">
      {name ? <title>{tooltipLabel}</title> : null}
      <rect
        x={x + inset}
        y={y + inset}
        width={cellW}
        height={cellH}
        fill={fill}
        stroke={isSelected ? "var(--md-sys-color-primary)" : "transparent"}
        strokeWidth={isSelected ? 2 : 0}
        rx={corner}
        ry={corner}
        aria-label={name || undefined}
        opacity={isSelected ? 1 : 0.94}
      />
      {showText && label && (
        <>
          <text
            x={x + inset + 3}
            y={y + inset + 12}
            fill="var(--md-sys-color-on-surface)"
            stroke="var(--md-sys-color-surface)"
            strokeWidth="0.5"
            fontSize={Math.max(7, Math.min(10, Math.floor(width / 7)))}
            fontWeight={600}
          >
            {label}
          </text>
          {height > 24 && (
            <text x={x + inset + 3} y={y + inset + 21} fill="var(--md-sys-color-on-surface-variant)" fontSize={6.5}>
              {humanSize(value)}
            </text>
          )}
        </>
      )}
    </g>
  );
}

interface TreemapProps {
  root: TreeNode;
  onDelete: (path: string) => Promise<void>;
  onFindDuplicates: () => Promise<DuplicateFindResult>;
}

/** Interactive storage treemap and sunburst panel with bulk delete controls. */
export default function Treemap({ root, onDelete, onFindDuplicates }: TreemapProps) {
  // View toggle for the two Recharts disk-usage visualizations
  const [view, setView] = useState<"nested-treemap" | "sunburst">("nested-treemap");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [minSizeMB, setMinSizeMB] = useState(0);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // Side list + filters continue to operate against root children (charts show full hierarchy)
  const visibleChildren = useMemo(() => {
    let kids = root.children || [];
    if (minSizeMB > 0) {
      const minBytes = minSizeMB * 1024 * 1024;
      kids = kids.filter((k) => (k.size || 0) >= minBytes);
    }
    if (search) {
      const q = search.toLowerCase();
      kids = kids.filter((k) => k.name.toLowerCase().includes(q) || (k.path && k.path.toLowerCase().includes(q)));
    }
    return kids;
  }, [root, search, minSizeMB]);

  const totalSize = root.size || 0;

  function toggleSelect(node: TreeNode) {
    const newSel = new Set(selected);
    if (newSel.has(node.path)) {
      newSel.delete(node.path);
    } else {
      newSel.add(node.path);
    }
    setSelected(newSel);
  }

  const chartData = useMemo(() => toRechartsData(root), [root]);

  // Sunburst: largest top-level segments with per-segment MD3 fills + external legend (Recharts labels show raw values).
  const sunburstSegments = useMemo((): SunburstSegment[] => {
    if (!chartData.children || chartData.children.length === 0) return [];
    return [...chartData.children]
      .sort((a, b) => b.value - a.value)
      .slice(0, SUNBURST_MAX_SEGMENTS)
      .map((c, i) => {
        const displayName = c.name || "";
        const isSelected = selected.has(c.path);
        const baseFill = SUNBURST_SEGMENT_PALETTE[i % SUNBURST_SEGMENT_PALETTE.length];
        return {
          ...c,
          name: displayName,
          displayName,
          shortName: truncateSunburstName(displayName),
          fill: isSelected ? SUNBURST_SELECTED_FILL : baseFill,
          children: undefined
        };
      });
  }, [chartData, selected]);

  const sunburstData = useMemo(() => {
    if (sunburstSegments.length === 0) return chartData;
    return { ...chartData, children: sunburstSegments };
  }, [chartData, sunburstSegments]);

  const [chartEl, setChartEl] = useState<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 400, height: 360 });

  useEffect(() => {
    if (!chartEl) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 400, height: 360 };
      setChartSize({ width: Math.max(width, 200), height: Math.max(height, 200) });
    });
    ro.observe(chartEl);
    return () => ro.disconnect();
  }, [chartEl]);

  const sunburstRadii = useMemo(() => {
    const minDim = Math.min(chartSize.width, chartSize.height);
    const innerRadius = Math.max(Math.round(minDim * 0.22), 32);
    const outerRadius = Math.min(Math.round(minDim * 0.46), Math.round(minDim / 2) - 8);
    return { innerRadius, outerRadius: Math.max(outerRadius, innerRadius + 40), minDim };
  }, [chartSize]);

  // For the nested treemap we show *top-level children* as the initial tiles
  // (so the mosaic displays the actual large items instead of a single "root" container).
  // Their .children (if present) still enable Recharts "nest" drill/zoom on click.
  const treemapData = useMemo(() => {
    return chartData.children && chartData.children.length > 0 ? chartData.children : [chartData];
  }, [chartData]);

  function handleChartClick(data: unknown) {
    // Robust extraction across Recharts Treemap + Sunburst click payloads.
    // Uses unknown + guards (no explicit any).
    if (!data || typeof data !== "object") return;
    const d = data as Record<string, unknown>;
    const payload = d.payload as RechartsChartNode | undefined;
    const activePayload = (d as { activePayload?: Array<{ payload?: unknown }> }).activePayload;
    const activeP0 = activePayload?.[0]?.payload as RechartsChartNode | undefined;
    const directValue = d.value as RechartsChartNode | undefined;
    const datum: RechartsChartNode = payload || activeP0 || directValue || (d as RechartsChartNode);
    const p = datum.path || datum.name;
    if (!p) return;
    // Reconstruct minimal node-like for toggle (path is enough)
    toggleSelect({
      name: datum.name || "",
      path: String(p),
      size: Number(datum.value) || 0,
      isDir: !!datum.isDir
    } as TreeNode);
  }

  function handleReset() {
    setSelected(new Set());
    setSearch("");
    setMinSizeMB(0);
  }

  async function handleBulkDelete() {
    setShowBulkConfirm(true);
  }

  async function confirmBulkDelete() {
    setShowBulkConfirm(false);
    setIsLoading(true);
    for (const p of selected) {
      try {
        await onDelete(p);
      } catch {
        /* continue bulk delete */
      }
    }
    setSelected(new Set());
    setIsLoading(false);
    handleReset();
  }

  async function handleFindDupes() {
    setIsLoading(true);
    await onFindDuplicates();
    setIsLoading(false);
  }

  // Recharts tooltip formatter (typed via unknown + guard/coerce).
  const tooltipFormatter = treemapTooltipFormatter;

  const chartTooltipProps = {
    formatter: tooltipFormatter,
    contentStyle: {
      background: "var(--md-sys-color-surface-variant)",
      border: "1px solid var(--md-sys-color-outline-variant)",
      borderRadius: "var(--md-sys-shape-corner-medium)",
      color: "var(--md-sys-color-on-surface)",
      fontSize: 12,
      padding: "6px 10px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.35)"
    },
    labelStyle: { color: "var(--md-sys-color-on-surface-variant)" },
    itemStyle: { color: "var(--md-sys-color-primary)" }
  };

  // Recharts SunburstChart renders dataKey values as arc text — hide and use legend + center hub instead.
  const sunburstTextOptions = useMemo(
    () => ({
      fill: "transparent",
      fontSize: "0",
      pointerEvents: "none" as const
    }),
    []
  );

  const treemapNestIndexContent = useMemo(
    () => (item: RechartsChartNode, index: number) => renderTreemapNestCrumb(item, index, root.name),
    [root.name]
  );

  return (
    <div data-testid="treemap">
      <div
        data-testid="treemap-controls"
        className="mb-4 min-h-[5.5rem] space-y-3 rounded-xl border border-[var(--md-sys-color-outline-variant)]/50 bg-[var(--md-sys-color-surface-variant)]/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {/* View toggle - compact segmented control for the two Recharts charts */}
          <div className="flex rounded-md border border-[var(--md-sys-color-outline-variant)] overflow-hidden">
            <Button
              data-testid="treemap-view-treemap"
              onClick={() => setView("nested-treemap")}
              variant={view === "nested-treemap" ? "default" : "outline"}
              size="sm"
              className="h-8 rounded-none border-0 text-xs first:rounded-l-md px-2.5 min-w-[5.5rem]"
            >
              Treemap
            </Button>
            <Button
              data-testid="treemap-view-sunburst"
              onClick={() => setView("sunburst")}
              variant={view === "sunburst" ? "default" : "outline"}
              size="sm"
              className="h-8 rounded-none border-0 text-xs last:rounded-r-md px-2.5 min-w-[5.5rem]"
            >
              Sunburst
            </Button>
          </div>

          <Button onClick={handleReset} variant="outline" size="sm" className="text-xs">
            Reset
          </Button>

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="h-8 max-w-[200px] text-xs"
          />

          <Button onClick={handleFindDupes} disabled={isLoading} variant="secondary" size="sm" className="text-xs">
            Find Duplicates
          </Button>

          <Select value={String(minSizeMB)} onValueChange={(v) => setMinSizeMB(Number(v))}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="All sizes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">All sizes</SelectItem>
              <SelectItem value="10">≥ 10 MB</SelectItem>
              <SelectItem value="50">≥ 50 MB</SelectItem>
              <SelectItem value="200">≥ 200 MB</SelectItem>
              <SelectItem value="1024">≥ 1 GB</SelectItem>
            </SelectContent>
          </Select>

          {selected.size > 0 && (
            <Button onClick={handleBulkDelete} disabled={isLoading} variant="destructive" size="sm" className="text-xs">
              Delete {selected.size} selected
            </Button>
          )}
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">
          {humanSize(totalSize)} • {visibleChildren.length} items visible
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:gap-6">
        <div
          data-testid="treemap-viz"
          data-chart-view={view}
          className={cn(
            "relative flex min-w-0 w-full max-w-[800px] flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] shadow-[0_1px_2px_0_rgba(0,0,0,0.4),0_4px_6px_-1px_rgba(0,0,0,0.35),0_10px_15px_-3px_rgba(0,0,0,0.3),0_20px_25px_-5px_rgba(0,0,0,0.2)]",
            view === "sunburst" ? "sunburst-viz" : "treemap-viz"
          )}
          style={{ height: view === "sunburst" ? 460 : 380 }}
        >
          <div
            ref={setChartEl}
            key={view}
            className={cn(
              "relative w-full bg-[var(--md-sys-color-surface)] p-1",
              view === "sunburst" ? "min-h-[220px] flex-1" : "h-[360px] shrink-0"
            )}
          >
            <ResponsiveContainer width="100%" height="100%">
              {view === "nested-treemap" ? (
                <RechartsTreemap
                  key={view}
                  className="treemap-chart"
                  data={treemapData}
                  dataKey="value"
                  nameKey="name"
                  type="nest"
                  aspectRatio={1.6}
                  stroke="transparent"
                  fill="transparent"
                  content={<TreemapCellContent selectedPaths={selected} />}
                  nestIndexContent={treemapNestIndexContent}
                  onClick={handleChartClick}
                >
                  <Tooltip {...chartTooltipProps} />
                </RechartsTreemap>
              ) : (
                <SunburstChart
                  key={view}
                  className="sunburst-chart"
                  data={sunburstData}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  innerRadius={sunburstRadii.innerRadius}
                  outerRadius={sunburstRadii.outerRadius}
                  padding={4}
                  ringPadding={0}
                  stroke="transparent"
                  fill="transparent"
                  onClick={handleChartClick}
                  textOptions={sunburstTextOptions}
                >
                  <Tooltip {...chartTooltipProps} />
                </SunburstChart>
              )}
            </ResponsiveContainer>
            {view === "sunburst" && (
              <SunburstCenterHub totalLabel={humanSize(totalSize)} itemCount={(root.children || []).length} />
            )}
          </div>
          {view === "sunburst" && <SunburstLegend segments={sunburstSegments} totalSize={totalSize} />}
        </div>

        <div
          data-testid="treemap-side-list"
          className="max-h-[300px] min-w-0 w-full shrink-0 overflow-auto rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] p-3 text-xs lg:max-h-[400px] lg:w-72"
        >
          <div className="md3-body-medium mb-2 px-1 font-semibold text-[var(--md-sys-color-primary)]">
            Largest at root
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-9 px-3">Name</TableHead>
                <TableHead className="h-9 px-3 text-right">Size</TableHead>
                <TableHead className="h-8 w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleChildren.slice(0, 12).map((node, i) => {
                const isSel = selected.has(node.path);
                return (
                  <TableRow
                    key={i}
                    onClick={() => toggleSelect(node)}
                    className={cn(
                      "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSel
                        ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] hover:bg-[var(--md-sys-color-primary-container)]"
                        : "hover:bg-[var(--md-sys-color-surface-variant)]"
                    )}
                  >
                    <TableCell className="max-w-[140px] truncate px-3 py-2 font-mono text-[11px]">
                      {node.name}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "px-3 py-2 text-right font-mono text-[11px] tabular-nums",
                        isSel ? "text-[var(--md-sys-color-on-primary-container)]" : "text-primary"
                      )}
                    >
                      {humanSize(node.size)}
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(node.path);
                        }}
                        variant="destructive"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        title={node.isDir ? "Delete directory" : "Delete file"}
                        aria-label={node.isDir ? "Delete directory" : "Delete file"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {isLoading && <div className="mt-1 text-xs text-primary">Working...</div>}

      <AlertDialog
        open={showBulkConfirm}
        onOpenChange={setShowBulkConfirm}
        title="Delete selected items?"
        description={`Move ${selected.size} selected paths to trash? This cannot be undone easily.`}
        confirmText="Delete selected"
        onConfirm={confirmBulkDelete}
        variant="destructive"
      />
    </div>
  );
}
