import type React from "react";
import { notFound } from "next/navigation";
import { StoragePanel } from "@/components/StoragePanel";
import { getStorageTree } from "@/lib/host";
import { fakeEmptyDuplicates } from "@/lib/mocks/fixtures";

/**
 * Isolated empty-dupes sheet fixture — separate route avoids overlaying other panel goldens.
 * @returns Dev-only StoragePanel with pre-opened empty dupes sheet.
 */
export default async function DevPanelsEmptyDupesPage(): Promise<React.JSX.Element> {
  if (process.env.NODE_ENV === "production" && process.env.USE_MOCKS !== "1") {
    notFound();
  }

  const initialTree = await getStorageTree("/mnt/models");

  return (
    <div className="min-h-screen bg-background p-8">
      <div data-testid="visual-panel-fixtures" className="mx-auto max-w-5xl">
        <StoragePanel initialTree={initialTree} visualDupesFixture={fakeEmptyDuplicates} visualShowDupesSheet />
      </div>
    </div>
  );
}
