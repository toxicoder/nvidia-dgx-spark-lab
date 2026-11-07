import type React from "react";

import { SecretsPanel } from "@/components/SecretsPanel";
import { SectionFailure } from "@/components/SectionFailure";
import { listSecrets } from "@/lib/host";
import { attempt, sectionFailureMessage } from "@/lib/section-result";

/**
 * Secrets Vault section: encrypted lab credentials and their Kubernetes sync.
 *
 * Only metadata reaches this route. Plaintext is decrypted per reveal, audited
 * first, and never enters this render path.
 *
 * @returns The secrets panel, or a failure state with retry.
 */
export default async function SecretsSection(): Promise<React.JSX.Element> {
  const secrets = await attempt(listSecrets);

  if (!secrets.ok) {
    return <SectionFailure title="Secrets Vault" message={sectionFailureMessage("secrets", secrets.error)} />;
  }

  return <SecretsPanel initialSecrets={secrets.data} />;
}
