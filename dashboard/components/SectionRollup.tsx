import type React from "react";
import Link from "next/link";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { SECTION_GROUP_LABELS, sectionsForGroup } from "@/lib/section-registry";
import type { DashboardSectionGroup } from "@/lib/types";

interface SectionNavCardProps {
  /** Route segment to link to. */
  slug: string;
  /** Card heading. */
  title: string;
  /** One-line description of what the section holds. */
  description: string;
  /** Rail icon, already resolved from the registry. */
  Icon: React.ComponentType<{ className?: string }>;
}

/**
 * One entry in the overview roll-up grid.
 *
 * The overview's job is orientation: given a symptom, which section do I open.
 * Each card is a single link to that section, so the overview stays useful even
 * when it cannot reach the host at all.
 *
 * @param props - Component props.
 * @param props.slug - Route segment to link to.
 * @param props.title - Card heading.
 * @param props.description - One-line description of what the section holds.
 * @param props.Icon - Rail icon resolved from the registry.
 * @returns The card, rendered as one link.
 */
export function SectionNavCard({ slug, title, description, Icon }: SectionNavCardProps): React.JSX.Element {
  return (
    <Link
      href={`/${slug}`}
      data-testid={`section-nav-card-${slug}`}
      className="group flex items-start gap-3 rounded-[var(--md-sys-shape-corner-medium)] border border-border bg-card p-4 transition-colors hover:border-primary/60 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--md-sys-shape-corner-small)] bg-secondary text-secondary-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-card-foreground group-hover:text-primary">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}

interface SectionRollupProps {
  /** Groups to render, in order. Defaults to every group. */
  groups?: readonly DashboardSectionGroup[];
}

/**
 * The overview's roll-up: every section, grouped by operator intent.
 *
 * @param props - Component props.
 * @param props.groups - Groups to render, in order. Defaults to every group.
 * @returns The grouped roll-up.
 */
export function SectionRollup({ groups }: SectionRollupProps): React.JSX.Element {
  const ordered = groups ?? (Object.keys(SECTION_GROUP_LABELS) as DashboardSectionGroup[]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {ordered.map((group) => (
        <Panel key={group}>
          <PanelHeader>
            <PanelTitle>{SECTION_GROUP_LABELS[group]}</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {sectionsForGroup(group).map((descriptor) => (
                <li key={descriptor.slug}>
                  <SectionNavCard
                    slug={descriptor.slug}
                    title={descriptor.label}
                    description={descriptor.description}
                    Icon={descriptor.icon}
                  />
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      ))}
    </div>
  );
}
