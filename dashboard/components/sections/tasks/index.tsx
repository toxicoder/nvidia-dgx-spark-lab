import type React from "react";

import { SectionFailure } from "@/components/SectionFailure";
import { TasksPanel } from "@/components/TasksPanel";
import { listContainers, listOllamaModels } from "@/lib/host";
import { attempt, firstError, sectionFailureMessage } from "@/lib/section-result";

/**
 * Tasks section: containers on the host and the models Ollama is serving.
 *
 * Both reads come from the same machine and the operator reads them together,
 * so they load as one and fail as one.
 *
 * @returns The tasks panel, or a failure state with retry.
 */
export default async function TasksSection(): Promise<React.JSX.Element> {
  const [containers, ollama] = await Promise.all([attempt(listContainers), attempt(listOllamaModels)]);

  if (!containers.ok || !ollama.ok) {
    return <SectionFailure title="Tasks" message={sectionFailureMessage("tasks", firstError([containers, ollama]))} />;
  }

  return <TasksPanel containers={containers.data} ollama={ollama.data} />;
}
