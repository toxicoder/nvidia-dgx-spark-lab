import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { SectionSkeleton } from "@/components/ui/section-skeleton";
import { findSection, SECTION_DESCRIPTORS, type SectionView } from "@/lib/section-registry";
import type { DashboardSectionSlug } from "@/lib/types";

import AgentChatSection from "@/components/sections/agent-chat";
import InferenceSection from "@/components/sections/inference";
import ObservabilitySection from "@/components/sections/observability";
import ResourcesSection from "@/components/sections/resources";
import SecretsSection from "@/components/sections/secrets";
import StorageSection from "@/components/sections/storage";
import SystemSection from "@/components/sections/system";
import TasksSection from "@/components/sections/tasks";
import UtilitiesSection from "@/components/sections/utilities";
import WorkspacesSection from "@/components/sections/workspaces";

/**
 * One console section per route, keyed by the `DASHBOARD_SECTIONS` closed set.
 *
 * The `Record` is what makes the wiring fail to compile: a slug added to the
 * closed set without a module here is a type error, and a module with no slug is
 * caught by `lib/__tests__/section-registry.test.ts`. That pair of gates is the
 * fix for the sidebar quietly losing the Agent Chat panel.
 */
const SECTION_VIEWS: Record<DashboardSectionSlug, SectionView> = {
  resources: ResourcesSection,
  observability: ObservabilitySection,
  inference: InferenceSection,
  "agent-chat": AgentChatSection,
  storage: StorageSection,
  tasks: TasksSection,
  workspaces: WorkspacesSection,
  system: SystemSection,
  utilities: UtilitiesSection,
  secrets: SecretsSection
};

/** Host state changes underneath us, so a section is never served from cache. */
export const dynamic = "force-dynamic";

interface SectionPageProps {
  params: Promise<{ section: string }>;
}

/**
 * Resolve the route param to a validated slug.
 *
 * @param params - Awaited Next.js route params.
 * @returns The slug the route can render.
 * @throws Via `notFound()` when the segment is not a known section.
 */
async function resolveSlug(params: Promise<{ section: string }>): Promise<DashboardSectionSlug> {
  const { section } = await params;
  const descriptor = findSection(section);
  if (!descriptor) notFound();
  return descriptor.slug;
}

/**
 * Per-route document metadata, so ten sections are not ten identical tabs.
 *
 * Previously every section shared one title, which made the console unusable in
 * a tab bar and unshareable from a runbook.
 *
 * @param props - Route props.
 * @param props.params - Awaited Next.js route params.
 * @returns Title and description for the section.
 */
export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const slug = await resolveSlug(params);
  // `slug` is already narrowed to the closed set by resolveSlug, so this index is total.
  const descriptor = SECTION_DESCRIPTORS[slug];
  return {
    title: descriptor.title,
    description: descriptor.description
  };
}

/**
 * Render one console section as its own route.
 *
 * The route owns the heading and the loading boundary; the section module owns
 * its data and its panels. That split is what lets one route's `error.tsx`
 * recover a single section instead of the whole console.
 *
 * @param props - Route props.
 * @param props.params - Awaited Next.js route params.
 * @returns The section page.
 */
export default async function SectionPage({ params }: SectionPageProps): Promise<React.JSX.Element> {
  const slug = await resolveSlug(params);
  // resolveSlug already rejected anything outside the closed set, so this index is total
  // and needs no guard; the notFound() that matters lives in resolveSlug.
  const descriptor = SECTION_DESCRIPTORS[slug];
  const View = SECTION_VIEWS[slug];

  return (
    <div className="space-y-6">
      <PageHeader title={descriptor.title} description={descriptor.description} />
      <Suspense fallback={<SectionSkeleton />}>
        <View />
      </Suspense>
    </div>
  );
}
