import type React from "react";
import { notFound } from "next/navigation";
import { VisualUtilitySheetFixture } from "./VisualUtilitySheetFixture";

/**
 * Isolated utility result sheet fixture — reliable golden capture without Run flow timing.
 * @returns Dev-only page with pre-opened utility result sheet.
 */
export default function DevPanelsUtilitySheetPage(): React.JSX.Element {
  if (process.env.NODE_ENV === "production" && process.env.USE_MOCKS !== "1") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div data-testid="visual-panel-fixtures">
        <VisualUtilitySheetFixture />
      </div>
    </div>
  );
}
