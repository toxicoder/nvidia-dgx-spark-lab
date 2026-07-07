"use client";

import type React from "react";
import { Sheet } from "@/components/ui/sheet";
import { UtilityOutput } from "@/components/UtilityOutput";
import type { UtilityRunResult } from "@/lib/types";

const fakeRunResult: UtilityRunResult = {
  stdout: JSON.stringify(
    {
      ok: true,
      utility: "spark-clock",
      spark_time: "2026-06-28T12:00:00Z",
      nodes: ["dgx-spark-1", "dgx-spark-2"]
    },
    null,
    2
  ),
  stderr: "",
  exitCode: 0
};

/**
 * Pre-opened utility result sheet for visual goldens.
 * @returns Sheet component with fake `spark-clock` run output.
 */
export function VisualUtilitySheetFixture(): React.JSX.Element {
  return (
    <Sheet open onOpenChange={() => {}} title="Result: spark-clock">
      <UtilityOutput result={fakeRunResult} />
    </Sheet>
  );
}
