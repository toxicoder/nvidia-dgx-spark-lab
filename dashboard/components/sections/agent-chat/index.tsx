import type React from "react";

import { OpenWebUIPanel } from "@/components/OpenWebUIPanel";
import { SectionFailure } from "@/components/SectionFailure";
import { getOpenWebUIStatus } from "@/lib/host";
import { attempt, sectionFailureMessage } from "@/lib/section-result";

/**
 * Agent Chat section: Open WebUI and the Hermes agent stack behind it.
 *
 * @returns The Open WebUI panel, or a failure state with retry.
 */
export default async function AgentChatSection(): Promise<React.JSX.Element> {
  const status = await attempt(getOpenWebUIStatus);

  if (!status.ok) {
    return <SectionFailure title="Agent Chat" message={sectionFailureMessage("agent-chat", status.error)} />;
  }

  return <OpenWebUIPanel initialStatus={status.data} />;
}
