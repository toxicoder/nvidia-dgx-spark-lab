import type React from "react";

import { StoragePanel } from "@/components/StoragePanel";
import { SectionFailure } from "@/components/SectionFailure";
import { getStorageTree } from "@/lib/host";
import { attempt, sectionFailureMessage } from "@/lib/section-result";

/** Root the storage explorer opens on. */
const MODELS_ROOT = "/mnt/models";

/**
 * Storage section: what is using `/mnt/models` and what can be trashed.
 *
 * The tree walk is the slowest read in the console, which is the main reason
 * storage got its own route — it used to hold up the other nine sections.
 *
 * @returns The storage explorer, or a failure state with retry.
 */
export default async function StorageSection(): Promise<React.JSX.Element> {
  const tree = await attempt(() => getStorageTree(MODELS_ROOT));

  if (!tree.ok) {
    return <SectionFailure title="Storage" message={sectionFailureMessage("storage", tree.error)} />;
  }

  return <StoragePanel initialTree={tree.data} />;
}
