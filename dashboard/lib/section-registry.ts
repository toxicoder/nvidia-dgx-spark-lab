/**
 * Metadata for every console section, keyed by the {@link DashboardSectionSlug}
 * closed set.
 *
 * This module is deliberately free of server components: the sidebar is a client
 * component and imports it, so anything server-only (a panel that calls
 * `@/lib/host`) would break the client graph if it lived here. Each section's
 * view lives in `components/sections/<slug>/index.tsx` and is wired in
 * `app/(dashboard)/[section]/page.tsx`, which the router owns.
 *
 * Adding a section means three edits, and `//dashboard:test` fails if any one of
 * them is missing: the slug in `lib/types/index.ts`, a descriptor here, and a
 * module under `components/sections/`.
 */

import type React from "react";
import {
  Activity,
  Boxes,
  Brain,
  Container,
  Cpu,
  Gauge,
  HardDrive,
  KeyRound,
  MessageSquare,
  Monitor,
  Wrench
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { DashboardSectionGroup, DashboardSectionSlug } from "@/lib/types";

/**
 * Signature every `components/sections/<slug>/index.tsx` default export must
 * satisfy: an async server component that loads its own slice of host state and
 * renders its panels inside the page frame the route provides.
 *
 * It takes no props because the route is the only caller and has nothing to
 * pass; data fetching belongs to the section, which is what lets a route's
 * `error.tsx` fail one section instead of the whole console.
 */
export type SectionView = () => Promise<React.JSX.Element> | React.JSX.Element;

/** Everything the chrome needs to render one section: rail entry, heading, title. */
export interface SectionDescriptor {
  /** Route segment; also the value of `DASHBOARD_SECTIONS`. */
  readonly slug: DashboardSectionSlug;
  /** Short label in the sidebar rail. */
  readonly label: string;
  /** Page heading and the leading part of the document title. */
  readonly title: string;
  /** One-line subhead under the heading, and the per-route meta description. */
  readonly description: string;
  /** Rail icon. */
  readonly icon: LucideIcon;
  /** Which rail group the entry sits in. */
  readonly group: DashboardSectionGroup;
}

/** Rail group headings, in render order. */
export const SECTION_GROUP_LABELS: Record<DashboardSectionGroup, string> = {
  observe: "Observe",
  serve: "Serve",
  data: "Data",
  workloads: "Workloads",
  operate: "Operate"
};

/**
 * One descriptor per entry in {@link DashboardSectionSlug}.
 *
 * Keyed by slug so a missing entry is a compile error under the `Record`
 * rather than a section that quietly stops appearing in the rail.
 */
export const SECTION_DESCRIPTORS: Record<DashboardSectionSlug, SectionDescriptor> = {
  resources: {
    slug: "resources",
    label: "Resource Guard",
    title: "Resource Guard",
    description: "Cluster headroom the scheduler checks before any GPU workload starts.",
    icon: Gauge,
    group: "observe"
  },
  observability: {
    slug: "observability",
    label: "Observability",
    title: "Observability",
    description: "Grafana, Prometheus, and the node exporters that feed them.",
    icon: Activity,
    group: "observe"
  },
  inference: {
    slug: "inference",
    label: "Inference",
    title: "Inference Workloads",
    description: "Start and stop Nemotron stacks and single-model GPU jobs.",
    icon: Brain,
    group: "serve"
  },
  "agent-chat": {
    slug: "agent-chat",
    label: "Agent Chat",
    title: "Agent Chat",
    description: "Open WebUI and the Hermes agent stack behind it.",
    icon: MessageSquare,
    group: "serve"
  },
  storage: {
    slug: "storage",
    label: "Storage",
    title: "Storage",
    description: "What is using /mnt/models, and what can safely be trashed.",
    icon: HardDrive,
    group: "data"
  },
  tasks: {
    slug: "tasks",
    label: "Tasks",
    title: "Tasks",
    description: "Containers on the host and the models Ollama is serving.",
    icon: Container,
    group: "workloads"
  },
  workspaces: {
    slug: "workspaces",
    label: "Dev Workspaces",
    title: "Dev Workspaces",
    description: "Coder and Kasm environments, with their embedded consoles.",
    icon: Monitor,
    group: "workloads"
  },
  system: {
    slug: "system",
    label: "Machine State",
    title: "Machine State",
    description: "Identity, running services, and installed packages on the Spark.",
    icon: Cpu,
    group: "workloads"
  },
  utilities: {
    slug: "utilities",
    label: "Utilities",
    title: "Utilities",
    description: "Allow-listed maintenance scripts and the output of past runs.",
    icon: Wrench,
    group: "operate"
  },
  secrets: {
    slug: "secrets",
    label: "Secrets",
    title: "Secrets Vault",
    description: "Encrypted lab credentials and their Kubernetes sync targets.",
    icon: KeyRound,
    group: "operate"
  }
};

/**
 * The rail entries for one group, in {@link DashboardSectionSlug} order.
 *
 * @param group - The group to collect.
 * @returns Descriptors for that group, ordered as they should render.
 */
export function sectionsForGroup(group: DashboardSectionGroup): SectionDescriptor[] {
  return Object.values(SECTION_DESCRIPTORS).filter((descriptor) => descriptor.group === group);
}

/**
 * Resolve a route segment to its descriptor.
 *
 * @param slug - Raw `[section]` route param; may be any string from the URL.
 * @returns The descriptor, or `undefined` when the segment is not a known section.
 */
export function findSection(slug: string): SectionDescriptor | undefined {
  return Object.values(SECTION_DESCRIPTORS).find((descriptor) => descriptor.slug === slug);
}

/**
 * Rail icon for a group, used by the overview roll-up cards.
 *
 * @param slug - Section to look up.
 * @returns The descriptor's icon, or the generic boxes icon when unknown.
 */
export function sectionIcon(slug: string): LucideIcon {
  return findSection(slug)?.icon ?? Boxes;
}
